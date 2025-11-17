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
            Ok(()) // TODO: implement withdraw to the donors and set project status to failed.
        } else if *status == ProjectStatus::TargetReached {
            Ok(()) // TODO: implement total amount withdraw to the owner and set project status as success.
        } else {
            err!(CustomError::InvalidProjectStatus)
        }
    }

    // Helper function to get donator count (can be called via view)
    pub fn get_donator_count(ctx: Context<RunningProject>) -> Result<u64> {
        Ok(ctx.accounts.project.donators.len() as u64)
    }

    // Future function for refunding donators if project fails
    // pub fn refund_donators(ctx: Context<RefundProject>) -> Result<()> {
    //     // TODO: Implement refund logic for each donator in the vector
    //     // This will iterate through ctx.accounts.project.donators 
    //     // and transfer back their amounts
    //     Ok(())
    // }

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
