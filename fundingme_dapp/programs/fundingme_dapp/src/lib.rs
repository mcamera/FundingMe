use anchor_lang::prelude::*;

pub mod errors;
use crate::errors::CustomError;

pub mod status;
use status::ProjectStatus;

declare_id!("DmcSC8vFAoLr756aDoqkV13S6kosdHHNuziRezhCcKUi");

#[program]
pub mod fundingme_dapp {
    use super::*;

    pub fn create_project(
        ctx: Context<CreateProject>,
        name: String,
        financial_target: u64,
    ) -> Result<()> {
        let project = &mut ctx.accounts.project;
        project.owner = *ctx.accounts.user.key;
        project.name = name;
        project.financial_target = financial_target;
        project.balance = 0;
        project.status = ProjectStatus::Active;
        project.donators = Vec::new();
        project.bump = ctx.bumps.project;

        msg!("Greetings from: {:?}", ctx.program_id);
        msg!("Project Name: {}", project.name.to_string());
        msg!("Project Owner pubkey: {}", project.key().to_string());
        msg!("Project Data pubkey: {}", project.owner.key().to_string());
        msg!("Financial Target: {}", project.financial_target.to_string());
        msg!("Status: {:?}", project.status);
        Ok(())
    }

    pub fn donate(ctx: Context<RunningProject>, amount: u64) -> Result<()> {
        let txn = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.project.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke(
            &txn,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.project.to_account_info(),
            ],
        )?;

        (&mut ctx.accounts.project).balance += amount;
        
        // Add or update donator in the vector
        let donator_key = ctx.accounts.user.key();
        let donators = &mut ctx.accounts.project.donators;
        
        // Check if this user has already donated
        if let Some(existing_donator) = donators.iter_mut().find(|d| d.user == donator_key) {
            // Update existing donator's total amount
            existing_donator.amount += amount;
        } else {
            // Add new donator
            donators.push(Donator {
                user: donator_key,
                amount,
            });
        }

        if ctx.accounts.project.balance >= ctx.accounts.project.financial_target {
            ctx.accounts.project.status = ProjectStatus::TargetReached
        };

        Ok(())
    }

    pub fn close_project(ctx: Context<RunningProject>) -> Result<()> {
        let status = &ctx.accounts.project.status;

        if *status == ProjectStatus::Active {
            // Set status to Failed - this enables refunds
            ctx.accounts.project.status = ProjectStatus::Failed;
            
            // Mark that refunds are available but haven't started yet
            msg!("Project failed. Donators can now claim individual refunds.");
            msg!("Total donators to refund: {}", ctx.accounts.project.donators.len());
            msg!("Total amount to refund: {} lamports", ctx.accounts.project.balance);
            
            Ok(())
        } else if *status == ProjectStatus::TargetReached {
            // Set status to Success so it can be withdrawn later
            ctx.accounts.project.status = ProjectStatus::Success;
            Ok(())
        } else {
            err!(CustomError::InvalidProjectStatus)
        }
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        if ctx.accounts.project.status != ProjectStatus::Failed {
            return err!(CustomError::InvalidProjectStatus);
        }

        // Get donator key and find their entry
        let donator_key = ctx.accounts.donator.key();
        let donators = &ctx.accounts.project.donators;
        let donator_index_and_amount = donators.iter()
            .enumerate()
            .find(|(_, d)| d.user == donator_key)
            .map(|(index, donator)| (index, donator.amount));
        
        if let Some((donator_index, donator_amount)) = donator_index_and_amount {
            // Transfer lamports directly from project account to donator
            // This uses account info manipulation instead of system instruction
            let project_lamports = ctx.accounts.project.to_account_info().lamports();
            
            // Ensure project has enough lamports
            require!(
                project_lamports >= donator_amount,
                CustomError::InvalidProjectStatus
            );
            
            // Perform the transfer by manipulating account lamports directly
            **ctx.accounts.project.to_account_info().try_borrow_mut_lamports()? -= donator_amount;
            **ctx.accounts.donator.to_account_info().try_borrow_mut_lamports()? += donator_amount;
            
            // Update project state
            let project = &mut ctx.accounts.project;
            project.donators.remove(donator_index);
            project.balance -= donator_amount;

            msg!("Refunded {} lamports to {}", donator_amount, donator_key);
            msg!("Remaining donators: {}", project.donators.len());
            
            Ok(())
        } else {
            err!(CustomError::UserNotAuthorized) // Donator not found in list
        }
    }

    // Helper function to get donator count (can be called via view)
    pub fn get_donator_count(ctx: Context<RunningProject>) -> Result<u64> {
        Ok(ctx.accounts.project.donators.len() as u64)
    }

    pub fn withdraw(ctx: Context<WithdrawProject>) -> Result<()> {
        if ctx.accounts.project.status != ProjectStatus::Success {
            return err!(CustomError::ProjectWithdrawNotAvailable);
        }

        if ctx.accounts.user.key() != ctx.accounts.project.owner {
            return err!(CustomError::UserNotAuthorized);
        }

        // The PDA account will be automatically closed and all lamports 
        // (including both donations and rent exemption) will be transferred 
        // to the project owner due to the `close` constraint in WithdrawProject

        Ok(())
    }

    pub fn close_failed_project(ctx: Context<RefundProject>) -> Result<()> {
        if ctx.accounts.project.status != ProjectStatus::Failed {
            return err!(CustomError::InvalidProjectStatus);
        }

        // Only project owner can close failed project
        if ctx.accounts.user.key() != ctx.accounts.project.owner {
            return err!(CustomError::UserNotAuthorized);
        }

        // Ensure all donators have been refunded
        if !ctx.accounts.project.donators.is_empty() {
            return err!(CustomError::InvalidProjectStatus); // Still has unreturned funds
        }

        // PDA account will be automatically closed due to the `close` constraint
        // Any remaining lamports (rent exemption) will go to the project owner
        
        msg!("Failed project closed successfully. All donators have been refunded.");
        Ok(())
    }

}


#[derive(Accounts)]
pub struct CreateProject<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 5000, //  8 + 2 + 4 + 200 + 1,
        seeds = [b"project", user.key().as_ref()],
        bump,
    )]
    pub project: Account<'info, ProjectAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RunningProject<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub project: Account<'info, ProjectAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawProject<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        close = user,
        constraint = project.owner == user.key(),
        seeds = [b"project", project.owner.as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundProject<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        close = user,
        constraint = project.owner == user.key(),
        constraint = project.status == status::ProjectStatus::Failed,
        seeds = [b"project", project.owner.as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub donator: Signer<'info>,
    #[account(
        mut,
        constraint = project.status == status::ProjectStatus::Failed,
        seeds = [b"project", project.owner.as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectAccount>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ProjectAccount {
    owner: Pubkey,
    name: String,
    financial_target: u64,
    balance: u64,
    status: ProjectStatus,
    donators: Vec<Donator>,
    bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Donator {
    pub user: Pubkey,
    pub amount: u64,
}
