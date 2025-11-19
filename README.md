# FundingMe dApp

A decentralized crowdfunding platform built on Solana that enables users to create funding projects, accept donations from multiple contributors, and manage the complete funding lifecycle with transparent tracking and secure fund management.

**🚀 Live Demo:** [https://funding-me-rho.vercel.app/](https://funding-me-rho.vercel.app/)  
**📋 Solana Program ID:** `DmcSC8vFAoLr756aDoqkV13S6kosdHHNuziRezhCcKUi`

## 🌟 Features

- **Project Creation**: Initialize crowdfunding projects with custom names and financial targets
- **Multi-Donor Support**: Accept donations from multiple contributors with automatic tracking
- **Status Management**: Automatic progression through Active → TargetReached → Success/Failed states
- **Secure Withdrawals**: Project owners can withdraw funds only after reaching success status
- **Complete Refund System**: Individual donators can claim refunds from failed projects
- **Authorization Controls**: Robust permission system ensuring only authorized operations

## 🏗 Architecture

### Program Structure
- **Solana Program**: Rust/Anchor backend deployed on DevNet
- **Next.js Frontend**: TypeScript React application with wallet integration
- **PDA System**: Program Derived Addresses for deterministic project accounts

### Key Components
- **Project PDA**: `["project", owner_pubkey]` - unique project account per owner
- **Account Management**: Complete lifecycle with rent recovery
- **Status Tracking**: Automatic state transitions based on funding progress

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Rust and Anchor CLI (for program development)
- Solana CLI configured for DevNet
- Solana wallet with DevNet SOL

### Frontend Setup
```bash
cd fundingme_frontend
npm install
npm run dev
```

### Program Development
```bash
cd fundingme_dapp
yarn install
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

## 📱 How to Use

1. **Connect Wallet**: Connect your Solana wallet to DevNet
2. **Create Project**: Set up a crowdfunding project with name and financial target
3. **Share Project**: Share your wallet address for others to find and donate to your project
4. **Monitor Progress**: Track donations and funding progress in real-time
5. **Complete Project**: Withdraw funds (successful) or enable refunds (failed)


## 📱 How to Use (step-by-step)

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

## 🧪 Testing

Comprehensive test suite with **22 test scenarios** covering:
- Project lifecycle management
- Multi-donor functionality
- Security validations
- Refund system operations
- Authorization controls

```bash
cd fundingme_dapp
anchor test  # Run all tests
```

## 📁 Project Structure

```
program-mcamera/
├── fundingme_dapp/          # Solana program (Rust/Anchor)
│   ├── programs/            # Program source code
│   ├── tests/              # Test suite (22 scenarios)
│   └── target/             # Built artifacts and IDL
├── fundingme_frontend/      # Frontend application (Next.js)
│   ├── src/                # React components and logic
│   └── public/             # Static assets
└── PROJECT_DESCRIPTION.md  # Complete technical documentation
```

## 🛠 Tech Stack

**Backend:**
- Rust with Anchor Framework
- Solana blockchain (DevNet)
- Program Derived Addresses (PDAs)

**Frontend:**
- Next.js 15 with TypeScript
- Tailwind CSS + Shadcn UI
- Solana Wallet Adapters
- Anchor client integration

## 🔗 Links

- **[Frontend Repository](./fundingme_frontend/)** - Next.js dApp interface
- **[Solana Program](./fundingme_dapp/)** - Rust/Anchor backend
- **[Complete Documentation](./PROJECT_DESCRIPTION.md)** - Detailed technical specs
- **[Live Demo](https://funding-me-rho.vercel.app/)** - Deployed application

## 📝 Development Notes

This represents a first-time Solana development project with a focus on learning core concepts including PDAs, account management, and comprehensive testing. The implementation prioritizes functionality and security while acknowledging areas for optimization as Solana expertise grows.

**Key Learning Areas:**
- Solana account model and PDA patterns
- Anchor framework and constraint validation
- Multi-user state management
- Transaction handling and error management
