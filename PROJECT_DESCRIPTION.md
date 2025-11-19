# Project Description

**Deployed Frontend URL:** [https://funding-me-rho.vercel.app/](https://funding-me-rho.vercel.app/)

**Solana Program ID:** `DmcSC8vFAoLr756aDoqkV13S6kosdHHNuziRezhCcKUi`

## Project Overview

### Description
A decentralized crowdfunding platform built on Solana that enables users to create funding projects, accept donations from multiple contributors, and manage the complete funding lifecycle. The dApp supports both successful project completion with fund withdrawal and failed project scenarios with automatic refund capabilities. Each funding project maintains a transparent record of all donators and their contribution amounts, ensuring accountability and trust in the crowdfunding process. This dApp demonstrates basic Solana program development concepts including PDAs, account creation, and state management.

### Key Features
- **Project Creation**: Initialize crowdfunding projects with custom names and financial targets
- **Multi-Donor Support**: Accept donations from multiple contributors with automatic tracking
- **Status Management**: Automatic progression through Active → TargetReached → Success/Failed states
- **Cumulative Tracking**: Track individual donator contributions with cumulative amounts for multiple donations
- **Secure Withdrawals**: Project owners can withdraw funds only after reaching success status
- **Complete Refund System**: Individual donators can claim refunds from failed projects
- **Account Closure**: Automatic PDA cleanup with rent recovery for completed/failed projects
- **Authorization Controls**: Robust permission system ensuring only authorized operations

### How to Use the dApp
1. **Connect as Project Owner** - Connect your Solana wallet to the Solana DevNet to interact with the platform as a Project Owner.
2. **Create a New Project** - Set up a new crowdfunding project with your desired name and financial target, then click 'Create Project'.
3. **Connect as Donator** - Connect a different Solana wallet to the Solana DevNet to interact with the platform as a Donator.
4. **Make Donations** - Enter the project owner's Solana address in the search field and click 'Search'. The project information will appear below. Enter a donation amount and click 'Donate'.
5. **Monitor Progress** - Reconnect with the project owner wallet to see new donations reflected in the project information.
6. **Close a Successful Project** - Once the target is reached, click 'Close Project' to mark the project as successful and enable fund withdrawal.
7. **Withdraw Funds** - Click the 'Withdraw Funds' button to transfer all collected donations to your wallet. The project and its Solana PDA account will be deleted.
8. **Handle Project Failures** - If the project doesn't reach its target, click 'Close Project' to mark it as failed and enable individual refunds for all donators.
9. **Process Refunds** - Reconnect with the donator wallet, search for the project using the owner's address, then click 'Claim Your Refund' to recover your donations. The amount will be automatically deposited into your wallet.
10. **Close a Failed Project** - Reconnect with the project owner wallet and click 'Close Failed Project'. All remaining rent from the Solana account will be refunded to your wallet, and the Solana PDA account will be deleted.

## Program Architecture
The funding dApp uses a sophisticated architecture with comprehensive state management, multi-user support, and complete lifecycle handling. The program leverages Program Derived Addresses for deterministic project accounts and implements a donation tracking system with individual refund capabilities.

### PDA Usage
The program uses Program Derived Addresses to create unique, deterministic project accounts with proper ownership and security controls for each project owner.

**PDAs Used:**
- **Project PDA**: Derived from seeds `["project", owner_pubkey]` - ensures each user can create one unique project account that only they can manage, withdraw from, or close.

### Program Instructions
**Instructions Implemented:**
- **create_project**: Creates a new crowdfunding project with name, financial target, and initializes empty donator list
- **donate**: Allows users to contribute SOL to projects, automatically tracking individual donators and cumulative amounts
- **close_project**: Transitions project status from Active→Failed or TargetReached→Success based on current state
- **withdraw**: Enables project owners to withdraw all funds and close PDA account for successful projects
- **claim_refund**: Allows individual donators to claim their specific contribution amount from failed projects
- **close_failed_project**: Enables project owners to close failed project PDAs after all donators have been refunded
- **get_donator_count**: Helper view function to retrieve the number of unique donators for a project

### Account Structure
The main project account structure manages all aspects of the crowdfunding lifecycle with comprehensive state tracking:

```rust
#[account]
pub struct ProjectAccount {
    pub owner: Pubkey,              // Project creator's wallet address
    pub name: String,               // Project name/description  
    pub financial_target: u64,      // Target amount in lamports
    pub balance: u64,               // Current donated amount in lamports
    pub status: ProjectStatus,      // Current project state (Active/TargetReached/Success/Failed)
    pub donators: Vec<Donator>,     // List of all donators with their cumulative amounts
    pub bump: u8,                   // PDA bump seed for account derivation
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Donator {
    pub user: Pubkey,               // Donator's wallet address
    pub amount: u64,                // Total cumulative donation amount from this user
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum ProjectStatus {
    Active,         // Accepting donations
    TargetReached,  // Goal met, ready for success/failure decision
    Success,        // Completed successfully, funds can be withdrawn
    Failed,         // Project failed, refunds are enabled
}
```

## Testing

### Test Coverage
Comprehensive test suite with 22 test scenarios covering the complete funding lifecycle, security validations, and error handling. Tests include both happy path functionality and extensive unhappy path security validations to ensure robust program behavior.

**Happy Path Tests:**
- **Project Initialization**: Successfully creates projects with valid parameters and proper account setup
- **Basic Donations**: Accepts individual donations and updates project balance correctly
- **Multiple Donations**: Handles multiple donors contributing to the same project
- **Donation Progress Tracking**: Monitors progress towards financial targets with accurate percentage calculations
- **Overfunding Scenarios**: Properly handles donations that exceed the target amount
- **Partial Funding**: Tracks projects that receive partial funding without reaching targets
- **Cumulative Donator Tracking**: Maintains accurate records of individual donator contributions across multiple donations
- **Successful Withdrawals**: Allows project owners to withdraw funds and close accounts for successful projects
- **Individual Refund Claims**: Enables donators to claim their specific amounts from failed projects
- **Failed Project Closure**: Allows project owners to close failed projects after all refunds are processed

**Unhappy Path Tests:**
- **Unauthorized Withdrawal Attempts**: Prevents non-owners from withdrawing project funds
- **Invalid Status Withdrawals**: Blocks withdrawals when project status is not Success
- **Non-Donator Refund Claims**: Rejects refund claims from users who never donated
- **Invalid Status Refunds**: Prevents refund claims when project is not marked as Failed  
- **Duplicate Refund Prevention**: Blocks multiple refund claims from the same donator
- **Premature Project Closure**: Prevents closing failed projects while unreturned funds remain

### Running Tests
```bash
cd fundingme_dapp
yarn install           # Install dependencies
anchor build           # Build the program
anchor test            # Run complete test suite (22 tests)
# Alternative: anchor test --skip-local-validator  # If validator already running
```

**Test Results**: All 22 tests passing with comprehensive coverage including:
- 1 project initialization test
- 6 donation functionality tests  
- 3 withdrawal validation tests
- 6 refund system validation tests
- Multiple security and authorization tests

### Additional Notes for Evaluators

This is my first Solana program development project, and the learning curve was incredibly steep and challenging. Building this crowdfunding dApp took much more time than anticipated due to my limited knowledge of Solana program architecture and the complexities involved.

**Development Challenges & Learning Journey:**
- **Steep Learning Curve**: Coming from other blockchain environments, understanding Solana's account model, PDAs, and Anchor framework was extremely difficult initially
- **Time Investment**: This project required significantly more time than expected - debugging account constraints, understanding ownership models, and implementing proper security took days of trial and error
- **Complex Debugging**: Solana error messages were often cryptic, making it difficult to identify issues. Simple concepts like account initialization and constraint validation took multiple attempts to get right
- **PDA Confusion**: Understanding Program Derived Addresses and how to properly seed and manage them was one of the most challenging aspects

**Areas Where I Struggled:**
- **Refund Implementation**: I acknowledge that the current refund system may not be the most elegant or efficient solution. Due to my limited Solana knowledge, I resorted to direct lamport manipulation to solve the "Transfer: `from` must not carry data" error, but there might be better patterns I'm not aware of
- **Account Management**: Proper account closure and rent recovery took multiple iterations to implement correctly
- **Error Handling**: Creating meaningful custom errors and constraint validations was challenging without deep Solana experience
- **Testing Complexity**: Writing comprehensive tests for all the edge cases required learning Mocha, understanding async transaction handling, and dealing with account state management

**Despite the Difficulties:**
While I recognize my solution may not be optimal due to my beginner status with Solana development, I'm proud that I managed to create a functional crowdfunding platform with complete lifecycle management, proper authorization, and extensive test coverage. The refund system works correctly even if the implementation approach might not follow best practices that more experienced Solana developers would use.

This project represents my genuine effort to learn and apply Solana program development concepts, even though the journey was much more difficult than initially expected.
