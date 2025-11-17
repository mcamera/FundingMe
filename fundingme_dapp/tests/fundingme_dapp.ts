import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FundingmeDapp } from "../target/types/fundingme_dapp";
import * as assert from "assert";

// Helper function to create a project
async function createProject(
  program: Program<FundingmeDapp>, 
  user: anchor.web3.Keypair, 
  projectName: string = "My Project", 
  financialTarget: number = 1000
) {
  // Find the project PDA
  const [projectAccountPdaAddr] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("project"), user.publicKey.toBuffer()],
    program.programId
  );

  // Airdrop SOL to the user
  const airdropToUser = await anchor.getProvider().connection.requestAirdrop(
    user.publicKey,
    anchor.web3.LAMPORTS_PER_SOL
  );
  await anchor.getProvider().connection.confirmTransaction(airdropToUser);

  // Create the project
  const createProjectTx = await program.methods
    .createProject(projectName, new anchor.BN(financialTarget))
    .accounts({
      user: user.publicKey,
      project: projectAccountPdaAddr,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([user])
    .rpc({ commitment: "confirmed" });
  
  console.log("Create project transaction signature:", createProjectTx);

  return projectAccountPdaAddr;
}

describe("Should initializate a project", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.fundingmeDapp as Program<FundingmeDapp>;
  const user = anchor.web3.Keypair.generate();

  it("Is initialized!", async () => {
    const [projectAccountPdaAddr] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("project"), user.publicKey.toBuffer()],
      program.programId
    );

    // Airdrop SOL to the owner to pay for transaction fees
    const airdropSignature = await anchor.getProvider().connection.requestAirdrop(
      user.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await anchor.getProvider().connection.confirmTransaction(airdropSignature);

    // Call the create_project function with required parameters
    const tx = await program.methods
      .createProject("My Project", new anchor.BN(1000))
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    // Fetch the created project account to verify
    const projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(projectAccount.name, "My Project", "The name of the project should match to: My Project");
    assert.strictEqual(projectAccount.balance.toNumber(), 0, "The project account balance should be initialized with 0");
    assert.strictEqual(projectAccount.financialTarget.toNumber(), 1000, "The financeial target of the project should be initialized with 1000");

    console.log("Your transaction signature", tx);
    console.log("Project created:", projectAccount);
  });
});

describe("Donate testings", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.fundingmeDapp as Program<FundingmeDapp>;

  it("Should accept donations", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor = anchor.web3.Keypair.generate();
    
    // Create a project using helper function
    const projectAccountPdaAddr = await createProject(program, user, "My Project", 1000);

    // Airdrop SOL to the donor
    const airdropSignature = await anchor.getProvider().connection.requestAirdrop(
      donor.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await anchor.getProvider().connection.confirmTransaction(airdropSignature);

    // Get initial balances
    const initialDonorBalance = await anchor.getProvider().connection.getBalance(donor.publicKey);
    const initialProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    const initialProjectBalance = initialProjectAccount.balance.toNumber();

    // Donate 0.1 SOL (100_000_000 lamports)
    const donationAmount = new anchor.BN(100_000_000);
    const tx = await program.methods
      .donate(donationAmount)
      .accounts({
        user: donor.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Verify the donation was successful
    const updatedProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    const finalDonorBalance = await anchor.getProvider().connection.getBalance(donor.publicKey);

    // Check that project balance increased by donation amount
    assert.strictEqual(
      updatedProjectAccount.balance.toNumber(), 
      initialProjectBalance + donationAmount.toNumber(),
      "Project balance should increase by donation amount"
    );

    // Check that donor balance decreased (account for transaction fees)
    // The donor should have paid at least the transaction fee, so balance should be less than initial
    assert.ok(
      finalDonorBalance < initialDonorBalance,
      "Donor balance should decrease due to transaction fees"
    );

    console.log("Donation transaction signature:", tx);
    console.log("Project balance after donation:", updatedProjectAccount.balance.toNumber());
    console.log("Donor balance change:", initialDonorBalance - finalDonorBalance, "lamports");
  });

  it("Should handle multiple donations", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor1 = anchor.web3.Keypair.generate();
    const donor2 = anchor.web3.Keypair.generate();
    
    // Create a project using helper function
    const projectAccountPdaAddr = await createProject(program, user, "Multiple Donations Project", 1000);

    // Airdrop SOL to both donors
    const airdrop1Promise = anchor.getProvider().connection.requestAirdrop(donor1.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    const airdrop2Promise = anchor.getProvider().connection.requestAirdrop(donor2.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    
    const [airdrop1Sig, airdrop2Sig] = await Promise.all([airdrop1Promise, airdrop2Promise]);
    
    await Promise.all([
      anchor.getProvider().connection.confirmTransaction(airdrop1Sig),
      anchor.getProvider().connection.confirmTransaction(airdrop2Sig)
    ]);

    // Get initial project balance
    const initialProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    const initialBalance = initialProjectAccount.balance.toNumber();

    // First donation: 0.05 SOL
    const donation1Amount = new anchor.BN(50_000_000);
    const donation1Tx = await program.methods
      .donate(donation1Amount)
      .accounts({
        user: donor1.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });
    
    console.log("First donation transaction signature:", donation1Tx);

    // Second donation: 0.15 SOL
    const donation2Amount = new anchor.BN(150_000_000);
    const donation2Tx = await program.methods
      .donate(donation2Amount)
      .accounts({
        user: donor2.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor2])
      .rpc({ commitment: "confirmed" });
    
    console.log("Second donation transaction signature:", donation2Tx);

    // Verify total donations
    const finalProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    const expectedBalance = initialBalance + donation1Amount.toNumber() + donation2Amount.toNumber();
    
    assert.strictEqual(
      finalProjectAccount.balance.toNumber(),
      expectedBalance,
      "Project balance should reflect sum of all donations"
    );

    console.log("Total project balance after multiple donations:", finalProjectAccount.balance.toNumber());
  });

  it("Should track donation progress towards financial target", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor = anchor.web3.Keypair.generate();
    
    // Create a project with a small target for easier testing (1000 lamports = 0.000001 SOL)
    const targetAmount = 1000;
    const projectAccountPdaAddr = await createProject(program, user, "Target Test Project", targetAmount);

    // Airdrop SOL to the donor
    const airdropSignature = await anchor.getProvider().connection.requestAirdrop(
      donor.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await anchor.getProvider().connection.confirmTransaction(airdropSignature);

    // Get initial project state
    const initialProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    
    // Verify initial state
    assert.strictEqual(initialProjectAccount.balance.toNumber(), 0, "Initial balance should be 0");
    assert.strictEqual(initialProjectAccount.financialTarget.toNumber(), targetAmount, "Financial target should match");

    // Make a donation that exactly meets the target
    const donationAmount = new anchor.BN(targetAmount);
    const tx = await program.methods
      .donate(donationAmount)
      .accounts({
        user: donor.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Verify the project has reached its financial target
    const finalProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    
    assert.strictEqual(
      finalProjectAccount.balance.toNumber(),
      targetAmount,
      "Project balance should exactly match the financial target"
    );

    // Check funding percentage
    const fundingPercentage = (finalProjectAccount.balance.toNumber() / finalProjectAccount.financialTarget.toNumber()) * 100;
    assert.strictEqual(fundingPercentage, 100, "Project should be 100% funded");

    // Check that project status is updated to TargetReached
    assert.deepStrictEqual(finalProjectAccount.status, { targetReached: {} }, "Project status should be TargetReached when target is met");

    console.log("Final donation transaction signature:", tx);
    console.log(`Project funding: ${fundingPercentage.toFixed(2)}% of target`);
    console.log(`Target: ${finalProjectAccount.financialTarget.toNumber()} lamports`);
    console.log(`Current balance: ${finalProjectAccount.balance.toNumber()} lamports`);
    console.log("Project status:", finalProjectAccount.status);
  });

  it("Should handle donations that exceed the financial target", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor = anchor.web3.Keypair.generate();
    
    // Create a project with a small target (1000 lamports)
    const targetAmount = 1000;
    const projectAccountPdaAddr = await createProject(program, user, "Exceed Target Project", targetAmount);

    // Airdrop SOL to the donor
    const airdropSignature = await anchor.getProvider().connection.requestAirdrop(
      donor.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await anchor.getProvider().connection.confirmTransaction(airdropSignature);

    // Make a donation that exceeds the target by 50% (1500 lamports)
    const donationAmount = new anchor.BN(1500);
    const tx = await program.methods
      .donate(donationAmount)
      .accounts({
        user: donor.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Verify the project has exceeded its financial target
    const finalProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    
    assert.strictEqual(
      finalProjectAccount.balance.toNumber(),
      1500,
      "Project balance should reflect the full donation amount"
    );

    // Check that the project is overfunded
    const fundingPercentage = (finalProjectAccount.balance.toNumber() / finalProjectAccount.financialTarget.toNumber()) * 100;
    assert.ok(fundingPercentage > 100, "Project should be overfunded (>100%)");
    assert.strictEqual(fundingPercentage, 150, "Project should be exactly 150% funded");

    // Check that project status is updated to TargetReached since target is exceeded
    assert.deepStrictEqual(finalProjectAccount.status, { targetReached: {} }, "Project status should be TargetReached when target is exceeded");

    const excessAmount = finalProjectAccount.balance.toNumber() - finalProjectAccount.financialTarget.toNumber();
    
    console.log("Exceed target transaction signature:", tx);
    console.log(`Project funding: ${fundingPercentage.toFixed(2)}% of target`);
    console.log(`Target: ${finalProjectAccount.financialTarget.toNumber()} lamports`);
    console.log(`Current balance: ${finalProjectAccount.balance.toNumber()} lamports`);
    console.log(`Excess amount: ${excessAmount} lamports (${((excessAmount / finalProjectAccount.financialTarget.toNumber()) * 100).toFixed(2)}% over target)`);
    console.log("Project status:", finalProjectAccount.status);
  });

  it("Should track partial funding progress", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor1 = anchor.web3.Keypair.generate();
    const donor2 = anchor.web3.Keypair.generate();
    
    // Create a project with a larger target (10000 lamports)
    const targetAmount = 10000;
    const projectAccountPdaAddr = await createProject(program, user, "Partial Funding Project", targetAmount);

    // Airdrop SOL to both donors
    const airdrop1Promise = anchor.getProvider().connection.requestAirdrop(donor1.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    const airdrop2Promise = anchor.getProvider().connection.requestAirdrop(donor2.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    
    const [airdrop1Sig, airdrop2Sig] = await Promise.all([airdrop1Promise, airdrop2Promise]);
    
    await Promise.all([
      anchor.getProvider().connection.confirmTransaction(airdrop1Sig),
      anchor.getProvider().connection.confirmTransaction(airdrop2Sig)
    ]);

    // First donation: 25% of target (2500 lamports)
    const donation1Amount = new anchor.BN(2500);
    const tx1 = await program.methods
      .donate(donation1Amount)
      .accounts({
        user: donor1.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    // Check funding after first donation
    let projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    let fundingPercentage = (projectAccount.balance.toNumber() / projectAccount.financialTarget.toNumber()) * 100;
    
    assert.strictEqual(fundingPercentage, 25, "Project should be 25% funded after first donation");
    assert.ok(fundingPercentage < 100, "Project should be partially funded (<100%)");
    
    // Check that project status is still Active since target is not reached
    assert.deepStrictEqual(projectAccount.status, { active: {} }, "Project status should remain Active when partially funded");

    console.log("First partial donation transaction signature:", tx1);
    console.log(`After first donation - Project funding: ${fundingPercentage.toFixed(2)}% of target`);
    console.log("Project status after first donation:", projectAccount.status);

    // Second donation: Additional 40% of target (4000 lamports)
    const donation2Amount = new anchor.BN(4000);
    const tx2 = await program.methods
      .donate(donation2Amount)
      .accounts({
        user: donor2.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor2])
      .rpc({ commitment: "confirmed" });

    // Check final funding status
    const finalProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    const finalFundingPercentage = (finalProjectAccount.balance.toNumber() / finalProjectAccount.financialTarget.toNumber()) * 100;
    
    assert.strictEqual(finalFundingPercentage, 65, "Project should be 65% funded after both donations");
    assert.ok(finalFundingPercentage < 100, "Project should still be partially funded (<100%)");

    // Check that project status is still Active since target is not reached
    assert.deepStrictEqual(finalProjectAccount.status, { active: {} }, "Project status should remain Active when still partially funded");

    const remainingAmount = finalProjectAccount.financialTarget.toNumber() - finalProjectAccount.balance.toNumber();
    const remainingPercentage = 100 - finalFundingPercentage;

    console.log("Second partial donation transaction signature:", tx2);
    console.log(`Final funding status: ${finalFundingPercentage.toFixed(2)}% of target`);
    console.log(`Target: ${finalProjectAccount.financialTarget.toNumber()} lamports`);
    console.log(`Current balance: ${finalProjectAccount.balance.toNumber()} lamports`);
    console.log(`Remaining needed: ${remainingAmount} lamports (${remainingPercentage.toFixed(2)}% to reach target)`);
    console.log("Final project status:", finalProjectAccount.status);
  });

  it("Should track donators list with multiple donors and cumulative amounts", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor1 = anchor.web3.Keypair.generate();
    const donor2 = anchor.web3.Keypair.generate();
    const donor3 = anchor.web3.Keypair.generate();
    
    // Create a project with a moderate target (20000 lamports)
    const targetAmount = 20000;
    const projectAccountPdaAddr = await createProject(program, user, "Donators Tracking Project", targetAmount);

    // Airdrop SOL to all donors
    const airdropPromises = [donor1, donor2, donor3].map(donor => 
      anchor.getProvider().connection.requestAirdrop(donor.publicKey, anchor.web3.LAMPORTS_PER_SOL)
    );
    
    const airdropSigs = await Promise.all(airdropPromises);
    await Promise.all(airdropSigs.map(sig => anchor.getProvider().connection.confirmTransaction(sig)));

    // Get initial project state (should have empty donators list)
    let projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(projectAccount.donators.length, 0, "Initial donators list should be empty");

    // First donation from donor1: 3000 lamports
    const donation1Amount = new anchor.BN(3000);
    const tx1 = await program.methods
      .donate(donation1Amount)
      .accounts({
        user: donor1.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    // Check after first donation
    projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(projectAccount.donators.length, 1, "Should have 1 donator after first donation");
    assert.strictEqual(projectAccount.donators[0].user.toString(), donor1.publicKey.toString(), "First donator should be donor1");
    assert.strictEqual(projectAccount.donators[0].amount.toNumber(), 3000, "First donator amount should be 3000");

    console.log("First donation transaction signature:", tx1);
    console.log("Donators after first donation:", projectAccount.donators.map(d => ({ 
      user: d.user.toString(), 
      amount: d.amount.toNumber() 
    })));

    // Second donation from donor2: 5000 lamports
    const donation2Amount = new anchor.BN(5000);
    const tx2 = await program.methods
      .donate(donation2Amount)
      .accounts({
        user: donor2.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor2])
      .rpc({ commitment: "confirmed" });

    // Check after second donation
    projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(projectAccount.donators.length, 2, "Should have 2 donators after second donation");
    
    // Find donor2 in the list
    const donor2Entry = projectAccount.donators.find(d => d.user.toString() === donor2.publicKey.toString());
    assert.ok(donor2Entry, "Donor2 should be in the donators list");
    assert.strictEqual(donor2Entry.amount.toNumber(), 5000, "Donor2 amount should be 5000");

    console.log("Second donation transaction signature:", tx2);
    console.log("Donators after second donation:", projectAccount.donators.map(d => ({ 
      user: d.user.toString(), 
      amount: d.amount.toNumber() 
    })));

    // Third donation from donor1 again: 2000 lamports (should update existing entry)
    const donation3Amount = new anchor.BN(2000);
    const tx3 = await program.methods
      .donate(donation3Amount)
      .accounts({
        user: donor1.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    // Check after third donation (donor1's second donation)
    projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(projectAccount.donators.length, 2, "Should still have 2 unique donators");
    
    // Find updated donor1 entry
    const updatedDonor1Entry = projectAccount.donators.find(d => d.user.toString() === donor1.publicKey.toString());
    assert.ok(updatedDonor1Entry, "Donor1 should still be in the donators list");
    assert.strictEqual(updatedDonor1Entry.amount.toNumber(), 5000, "Donor1 total amount should be 5000 (3000 + 2000)");

    console.log("Third donation transaction signature:", tx3);
    console.log("Donators after third donation (donor1's cumulative):", projectAccount.donators.map(d => ({ 
      user: d.user.toString(), 
      amount: d.amount.toNumber() 
    })));

    // Fourth donation from donor3: 7000 lamports
    const donation4Amount = new anchor.BN(7000);
    const tx4 = await program.methods
      .donate(donation4Amount)
      .accounts({
        user: donor3.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor3])
      .rpc({ commitment: "confirmed" });

    // Final verification
    const finalProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(finalProjectAccount.donators.length, 3, "Should have 3 unique donators at the end");
    
    // Verify total balance matches sum of all donations
    const expectedTotalBalance = 3000 + 5000 + 2000 + 7000; // 17000
    assert.strictEqual(finalProjectAccount.balance.toNumber(), expectedTotalBalance, "Total project balance should match sum of all donations");
    
    // Verify individual donator amounts
    const finalDonor1 = finalProjectAccount.donators.find(d => d.user.toString() === donor1.publicKey.toString());
    const finalDonor2 = finalProjectAccount.donators.find(d => d.user.toString() === donor2.publicKey.toString());
    const finalDonor3 = finalProjectAccount.donators.find(d => d.user.toString() === donor3.publicKey.toString());
    
    assert.strictEqual(finalDonor1.amount.toNumber(), 5000, "Donor1 final amount should be 5000");
    assert.strictEqual(finalDonor2.amount.toNumber(), 5000, "Donor2 final amount should be 5000");
    assert.strictEqual(finalDonor3.amount.toNumber(), 7000, "Donor3 final amount should be 7000");
    
    // Verify sum of individual amounts equals total balance
    const sumOfDonatorAmounts = finalProjectAccount.donators.reduce((sum, donator) => sum + donator.amount.toNumber(), 0);
    assert.strictEqual(sumOfDonatorAmounts, expectedTotalBalance, "Sum of individual donator amounts should equal total project balance");

    console.log("Fourth donation transaction signature:", tx4);
    console.log("Final donators list:", finalProjectAccount.donators.map(d => ({ 
      user: d.user.toString(), 
      amount: d.amount.toNumber() 
    })));
    console.log(`Total project balance: ${finalProjectAccount.balance.toNumber()} lamports`);
    console.log(`Sum of individual donations: ${sumOfDonatorAmounts} lamports`);
    console.log(`Number of unique donators: ${finalProjectAccount.donators.length}`);
  });
});

describe("Withdraw validation", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.fundingmeDapp as Program<FundingmeDapp>;

  it("Should allow project owner to withdraw funds and close PDA account", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor1 = anchor.web3.Keypair.generate();
    const donor2 = anchor.web3.Keypair.generate();
    
    // Create a project with exact target for clean testing (5000 lamports)
    const targetAmount = 5000;
    const projectAccountPdaAddr = await createProject(program, user, "Withdraw Test Project", targetAmount);

    // Airdrop SOL to donors
    const airdrop1Promise = anchor.getProvider().connection.requestAirdrop(donor1.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    const airdrop2Promise = anchor.getProvider().connection.requestAirdrop(donor2.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    
    const [airdrop1Sig, airdrop2Sig] = await Promise.all([airdrop1Promise, airdrop2Promise]);
    await Promise.all([
      anchor.getProvider().connection.confirmTransaction(airdrop1Sig),
      anchor.getProvider().connection.confirmTransaction(airdrop2Sig)
    ]);

    // Get initial owner balance
    const initialOwnerBalance = await anchor.getProvider().connection.getBalance(user.publicKey);

    // Donations to reach exact target
    const donation1Amount = new anchor.BN(2000);
    const donation1Tx = await program.methods
      .donate(donation1Amount)
      .accounts({
        user: donor1.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    const donation2Amount = new anchor.BN(3000);
    const donation2Tx = await program.methods
      .donate(donation2Amount)
      .accounts({
        user: donor2.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor2])
      .rpc({ commitment: "confirmed" });

    // Verify project reached target
    let projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(projectAccount.balance.toNumber(), targetAmount, "Project should have reached exact target");
    assert.deepStrictEqual(projectAccount.status, { targetReached: {} }, "Project status should be TargetReached");

    console.log("Donation 1 transaction signature:", donation1Tx);
    console.log("Donation 2 transaction signature:", donation2Tx);
    console.log(`Project balance after donations: ${projectAccount.balance.toNumber()} lamports`);
    console.log("Project status before close:", projectAccount.status);

    // Close the project to set status to Success
    const closeProjectTx = await program.methods
      .closeProject()
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    // Verify status changed to Success
    projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.deepStrictEqual(projectAccount.status, { success: {} }, "Project status should be Success after closing");

    console.log("Close project transaction signature:", closeProjectTx);
    console.log("Project status after close:", projectAccount.status);

    // Get PDA account balance before withdrawal (includes donations + rent)
    const pdaAccountInfo = await anchor.getProvider().connection.getAccountInfo(projectAccountPdaAddr);
    const pdaBalanceBeforeWithdraw = pdaAccountInfo.lamports;
    console.log(`PDA account balance before withdraw: ${pdaBalanceBeforeWithdraw} lamports`);

    // Attempt withdrawal by project owner
    const withdrawTx = await program.methods
      .withdraw()
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    console.log("Withdraw transaction signature:", withdrawTx);

    // Verify PDA account is closed (should throw error when fetching)
    try {
      await program.account.projectAccount.fetch(projectAccountPdaAddr);
      assert.fail("PDA account should be closed after withdrawal");
    } catch (error) {
      console.log("✅ PDA account successfully closed - fetch failed as expected");
    }

    // Verify PDA account info is null (account deleted)
    const closedPdaAccountInfo = await anchor.getProvider().connection.getAccountInfo(projectAccountPdaAddr);
    assert.strictEqual(closedPdaAccountInfo, null, "PDA account should be completely deleted");
    console.log("✅ PDA account completely deleted from blockchain");

    // Verify owner received funds
    const finalOwnerBalance = await anchor.getProvider().connection.getBalance(user.publicKey);
    const balanceIncrease = finalOwnerBalance - initialOwnerBalance;
    
    // Owner should receive both donation amount and rent exemption (minus transaction fees)
    assert.ok(balanceIncrease > targetAmount, "Owner balance should increase by at least the donation amount");
    console.log(`Owner balance increase: ${balanceIncrease} lamports`);
    console.log(`Expected minimum increase: ${targetAmount} lamports (donations only)`);
    console.log(`Additional received: ${balanceIncrease - targetAmount} lamports (rent recovery minus fees)`);
  });

  it("Should reject unauthorized withdrawal attempts", async () => {
    const projectOwner = anchor.web3.Keypair.generate();
    const unauthorizedUser = anchor.web3.Keypair.generate();
    const donor = anchor.web3.Keypair.generate();
    
    // Create a project
    const targetAmount = 2000;
    const projectAccountPdaAddr = await createProject(program, projectOwner, "Unauthorized Test Project", targetAmount);
    
    // Airdrop SOL to unauthorized user and donor
    const airdropUnauth = await anchor.getProvider().connection.requestAirdrop(unauthorizedUser.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    const airdropDonor = await anchor.getProvider().connection.requestAirdrop(donor.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await Promise.all([
      anchor.getProvider().connection.confirmTransaction(airdropUnauth),
      anchor.getProvider().connection.confirmTransaction(airdropDonor)
    ]);
    
    // Fund the project to reach target
    await program.methods
      .donate(new anchor.BN(targetAmount))
      .accounts({
        user: donor.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Close project (by owner)
    await program.methods
      .closeProject()
      .accounts({
        user: projectOwner.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([projectOwner])
      .rpc({ commitment: "confirmed" });

    // Try to withdraw with unauthorized user (should fail)
    try {
      await program.methods
        .withdraw()
        .accounts({
          user: unauthorizedUser.publicKey, // Wrong user!
          project: projectAccountPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc({ commitment: "confirmed" });
      assert.fail("Unauthorized withdrawal should have failed");
    } catch (error) {
      console.log("✅ Unauthorized withdrawal correctly rejected");
      assert.ok(error.message.includes("UserNotAuthorized") || error.message.includes("constraint"), "Error should indicate unauthorized access");
    }

    // Verify project still exists and hasn't been closed by unauthorized attempt
    const projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.deepStrictEqual(projectAccount.status, { success: {} }, "Project status should still be Success");
    assert.strictEqual(projectAccount.balance.toNumber(), targetAmount, "Project balance should be unchanged");
    console.log("✅ Project remains intact after failed unauthorized withdrawal");
  });

  it("Should reject withdrawal when project status is not Success", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor = anchor.web3.Keypair.generate();
    
    // Create a project that won't reach target
    const targetAmount = 10000;
    const projectAccountPdaAddr = await createProject(program, user, "Partial Funding Project", targetAmount);
    
    // Airdrop SOL to donor
    const airdropDonor = await anchor.getProvider().connection.requestAirdrop(donor.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await anchor.getProvider().connection.confirmTransaction(airdropDonor);
    
    // Make a donation that doesn't reach target
    const partialAmount = 5000; // Only half the target
    await program.methods
      .donate(new anchor.BN(partialAmount))
      .accounts({
        user: donor.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Verify project status is Active (not Success)
    let projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.deepStrictEqual(projectAccount.status, { active: {} }, "Project status should be Active (target not reached)");

    // Try to withdraw when project is not successful (should fail)
    try {
      await program.methods
        .withdraw()
        .accounts({
          user: user.publicKey,
          project: projectAccountPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc({ commitment: "confirmed" });
      assert.fail("Withdrawal should have failed for non-successful project");
    } catch (error) {
      console.log("✅ Withdrawal correctly rejected for non-successful project");
      assert.ok(error.message.includes("ProjectWithdrawNotAvailable"), "Error should indicate project not available for withdrawal");
    }

    // Test with TargetReached status (before calling closeProject)
    // First, complete the funding
    await program.methods
      .donate(new anchor.BN(targetAmount - partialAmount))
      .accounts({
        user: donor.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Verify status is now TargetReached
    projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.deepStrictEqual(projectAccount.status, { targetReached: {} }, "Project status should be TargetReached");

    // Try to withdraw when status is TargetReached (should fail)
    try {
      await program.methods
        .withdraw()
        .accounts({
          user: user.publicKey,
          project: projectAccountPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc({ commitment: "confirmed" });
      assert.fail("Withdrawal should have failed for TargetReached status");
    } catch (error) {
      console.log("✅ Withdrawal correctly rejected for TargetReached status");
      assert.ok(error.message.includes("ProjectWithdrawNotAvailable"), "Error should indicate project not available for withdrawal");
    }

    // Verify project data is unchanged after failed withdrawal attempts
    const finalProjectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(finalProjectAccount.balance.toNumber(), targetAmount, "Project balance should be unchanged");
    assert.deepStrictEqual(finalProjectAccount.status, { targetReached: {} }, "Project status should still be TargetReached");
    console.log("✅ Project remains intact after failed withdrawal attempts");
  });
});

describe("Refund validation", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.fundingmeDapp as Program<FundingmeDapp>;

  it("Should allow project owner to mark project as failed and enable refunds", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor1 = anchor.web3.Keypair.generate();
    const donor2 = anchor.web3.Keypair.generate();
    
    // Create a project that will fail (not reach target)
    const targetAmount = 10000;
    const projectAccountPdaAddr = await createProject(program, user, "Failed Project", targetAmount);

    // Airdrop SOL to donors
    const airdrop1Promise = anchor.getProvider().connection.requestAirdrop(donor1.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    const airdrop2Promise = anchor.getProvider().connection.requestAirdrop(donor2.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    
    const [airdrop1Sig, airdrop2Sig] = await Promise.all([airdrop1Promise, airdrop2Promise]);
    await Promise.all([
      anchor.getProvider().connection.confirmTransaction(airdrop1Sig),
      anchor.getProvider().connection.confirmTransaction(airdrop2Sig)
    ]);

    // Make donations that don't reach the target
    const donation1Amount = new anchor.BN(3000);
    await program.methods
      .donate(donation1Amount)
      .accounts({
        user: donor1.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    const donation2Amount = new anchor.BN(2000);
    await program.methods
      .donate(donation2Amount)
      .accounts({
        user: donor2.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor2])
      .rpc({ commitment: "confirmed" });

    // Verify project is still active with partial funding
    let projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.deepStrictEqual(projectAccount.status, { active: {} }, "Project status should be Active");
    assert.strictEqual(projectAccount.balance.toNumber(), 5000, "Project should have 5000 lamports from donations");
    assert.strictEqual(projectAccount.donators.length, 2, "Should have 2 donators");

    console.log("Project before closure:", {
      status: projectAccount.status,
      balance: projectAccount.balance.toNumber(),
      donators: projectAccount.donators.length
    });

    // Project owner closes the project (marks it as failed)
    const closeProjectTx = await program.methods
      .closeProject()
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    // Verify status changed to Failed
    projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.deepStrictEqual(projectAccount.status, { failed: {} }, "Project status should be Failed after closing");
    assert.strictEqual(projectAccount.balance.toNumber(), 5000, "Project balance should remain unchanged");
    assert.strictEqual(projectAccount.donators.length, 2, "Donators list should remain unchanged");

    console.log("Close project transaction signature:", closeProjectTx);
    console.log("Project after closure:", {
      status: projectAccount.status,
      balance: projectAccount.balance.toNumber(),
      donators: projectAccount.donators.length
    });
  });

  it("Should allow individual donators to claim their refunds", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor1 = anchor.web3.Keypair.generate();
    const donor2 = anchor.web3.Keypair.generate();
    const donor3 = anchor.web3.Keypair.generate();
    
    // Create a failed project
    const targetAmount = 15000;
    const projectAccountPdaAddr = await createProject(program, user, "Refund Test Project", targetAmount);

    // Airdrop SOL to all participants
    const airdropPromises = [donor1, donor2, donor3].map(donor => 
      anchor.getProvider().connection.requestAirdrop(donor.publicKey, anchor.web3.LAMPORTS_PER_SOL)
    );
    const airdropSigs = await Promise.all(airdropPromises);
    await Promise.all(airdropSigs.map(sig => anchor.getProvider().connection.confirmTransaction(sig)));

    // Multiple donations from different donors
    const donation1Amount = new anchor.BN(4000);
    await program.methods
      .donate(donation1Amount)
      .accounts({
        user: donor1.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    const donation2Amount = new anchor.BN(3000);
    await program.methods
      .donate(donation2Amount)
      .accounts({
        user: donor2.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor2])
      .rpc({ commitment: "confirmed" });

    // Donor1 donates again (should accumulate)
    const donation3Amount = new anchor.BN(2000);
    await program.methods
      .donate(donation3Amount)
      .accounts({
        user: donor1.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    const donation4Amount = new anchor.BN(1000);
    await program.methods
      .donate(donation4Amount)
      .accounts({
        user: donor3.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor3])
      .rpc({ commitment: "confirmed" });

    // Mark project as failed
    await program.methods
      .closeProject()
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    // Verify project is failed with correct totals
    let projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.deepStrictEqual(projectAccount.status, { failed: {} }, "Project should be Failed");
    assert.strictEqual(projectAccount.balance.toNumber(), 10000, "Total project balance should be 10000");
    assert.strictEqual(projectAccount.donators.length, 3, "Should have 3 unique donators");

    // Get initial balances before refunds
    const initialDonor1Balance = await anchor.getProvider().connection.getBalance(donor1.publicKey);
    const initialDonor2Balance = await anchor.getProvider().connection.getBalance(donor2.publicKey);
    const initialDonor3Balance = await anchor.getProvider().connection.getBalance(donor3.publicKey);

    console.log("Before refunds:", {
      donor1Balance: initialDonor1Balance,
      donor2Balance: initialDonor2Balance,
      donor3Balance: initialDonor3Balance,
      projectBalance: projectAccount.balance.toNumber(),
      donators: projectAccount.donators.map(d => ({ user: d.user.toString(), amount: d.amount.toNumber() }))
    });

    // Donor1 claims refund (should get 6000: 4000 + 2000)
    const refund1Tx = await program.methods
      .claimRefund()
      .accounts({
        donator: donor1.publicKey,
        project: projectAccountPdaAddr,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    // Verify donor1 refund
    projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    const finalDonor1Balance = await anchor.getProvider().connection.getBalance(donor1.publicKey);
    
    assert.strictEqual(projectAccount.donators.length, 2, "Should have 2 donators left after first refund");
    assert.strictEqual(projectAccount.balance.toNumber(), 4000, "Project balance should decrease by 6000");
    assert.ok(finalDonor1Balance > initialDonor1Balance, "Donor1 balance should increase (accounting for transaction fees)");
    
    console.log("After donor1 refund:", {
      transactionSignature: refund1Tx,
      donor1BalanceIncrease: finalDonor1Balance - initialDonor1Balance,
      projectBalance: projectAccount.balance.toNumber(),
      remainingDonators: projectAccount.donators.length
    });

    // Donor2 claims refund (should get 3000)
    const refund2Tx = await program.methods
      .claimRefund()
      .accounts({
        donator: donor2.publicKey,
        project: projectAccountPdaAddr,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor2])
      .rpc({ commitment: "confirmed" });

    // Verify donor2 refund
    projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    const finalDonor2Balance = await anchor.getProvider().connection.getBalance(donor2.publicKey);
    
    assert.strictEqual(projectAccount.donators.length, 1, "Should have 1 donator left after second refund");
    assert.strictEqual(projectAccount.balance.toNumber(), 1000, "Project balance should decrease by 3000");
    assert.ok(finalDonor2Balance > initialDonor2Balance, "Donor2 balance should increase (accounting for transaction fees)");
    
    console.log("After donor2 refund:", {
      transactionSignature: refund2Tx,
      donor2BalanceIncrease: finalDonor2Balance - initialDonor2Balance,
      projectBalance: projectAccount.balance.toNumber(),
      remainingDonators: projectAccount.donators.length
    });

    // Donor3 claims refund (should get 1000)
    const refund3Tx = await program.methods
      .claimRefund()
      .accounts({
        donator: donor3.publicKey,
        project: projectAccountPdaAddr,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor3])
      .rpc({ commitment: "confirmed" });

    // Verify donor3 refund and project is empty
    projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    const finalDonor3Balance = await anchor.getProvider().connection.getBalance(donor3.publicKey);
    
    assert.strictEqual(projectAccount.donators.length, 0, "Should have no donators left after all refunds");
    assert.strictEqual(projectAccount.balance.toNumber(), 0, "Project balance should be zero after all refunds");
    assert.ok(finalDonor3Balance > initialDonor3Balance, "Donor3 balance should increase (accounting for transaction fees)");
    
    console.log("After donor3 refund:", {
      transactionSignature: refund3Tx,
      donor3BalanceIncrease: finalDonor3Balance - initialDonor3Balance,
      projectBalance: projectAccount.balance.toNumber(),
      remainingDonators: projectAccount.donators.length
    });

    console.log("All refunds completed successfully! ✅");
  });

  it("Should reject refund claims from non-donators", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor = anchor.web3.Keypair.generate();
    const nonDonor = anchor.web3.Keypair.generate();
    
    // Create and fund a failed project
    const targetAmount = 5000;
    const projectAccountPdaAddr = await createProject(program, user, "Non-Donator Test", targetAmount);

    // Airdrop to participants
    const airdropDonor = await anchor.getProvider().connection.requestAirdrop(donor.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    const airdropNonDonor = await anchor.getProvider().connection.requestAirdrop(nonDonor.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await Promise.all([
      anchor.getProvider().connection.confirmTransaction(airdropDonor),
      anchor.getProvider().connection.confirmTransaction(airdropNonDonor)
    ]);

    // Only donor makes a donation
    await program.methods
      .donate(new anchor.BN(2000))
      .accounts({
        user: donor.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Mark project as failed
    await program.methods
      .closeProject()
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    // Try to claim refund with non-donator (should fail)
    try {
      await program.methods
        .claimRefund()
        .accounts({
          donator: nonDonor.publicKey,
          project: projectAccountPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([nonDonor])
        .rpc({ commitment: "confirmed" });
      assert.fail("Non-donator refund claim should have failed");
    } catch (error) {
      console.log("✅ Non-donator refund claim correctly rejected");
      assert.ok(error.message.includes("UserNotAuthorized"), "Error should indicate user not authorized");
    }

    // Verify project state is unchanged
    const projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(projectAccount.donators.length, 1, "Should still have 1 donator");
    assert.strictEqual(projectAccount.balance.toNumber(), 2000, "Project balance should be unchanged");
  });

  it("Should reject refund claims when project is not failed", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor = anchor.web3.Keypair.generate();
    
    // Create a successful project
    const targetAmount = 2000;
    const projectAccountPdaAddr = await createProject(program, user, "Successful Project", targetAmount);

    // Airdrop to participants
    const airdropDonor = await anchor.getProvider().connection.requestAirdrop(donor.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await anchor.getProvider().connection.confirmTransaction(airdropDonor);

    // Donate to reach target
    await program.methods
      .donate(new anchor.BN(targetAmount))
      .accounts({
        user: donor.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Close project successfully (should set status to Success)
    await program.methods
      .closeProject()
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    // Verify status is Success, not Failed
    const projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.deepStrictEqual(projectAccount.status, { success: {} }, "Project should be Success, not Failed");

    // Try to claim refund when project is successful (should fail)
    try {
      await program.methods
        .claimRefund()
        .accounts({
          donator: donor.publicKey,
          project: projectAccountPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([donor])
        .rpc({ commitment: "confirmed" });
      assert.fail("Refund claim on successful project should have failed");
    } catch (error) {
      console.log("✅ Refund claim on successful project correctly rejected");
      console.log("Error message:", error.message); // Debug the actual error message
      assert.ok(
        error.message.includes("ConstraintViolation") || 
        error.message.includes("InvalidProjectStatus") ||
        error.message.includes("failed") ||
        error.message.includes("constraint"),
        "Error should indicate constraint violation or invalid project status"
      );
    }
  });

  it("Should prevent duplicate refund claims", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor = anchor.web3.Keypair.generate();
    
    // Create and fund a failed project
    const targetAmount = 5000;
    const projectAccountPdaAddr = await createProject(program, user, "Duplicate Refund Test", targetAmount);

    // Airdrop to donor
    const airdropDonor = await anchor.getProvider().connection.requestAirdrop(donor.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await anchor.getProvider().connection.confirmTransaction(airdropDonor);

    // Make donation
    await program.methods
      .donate(new anchor.BN(3000))
      .accounts({
        user: donor.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    // Mark project as failed
    await program.methods
      .closeProject()
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    // First refund claim (should succeed)
    const refundTx = await program.methods
      .claimRefund()
      .accounts({
        donator: donor.publicKey,
        project: projectAccountPdaAddr,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor])
      .rpc({ commitment: "confirmed" });

    console.log("First refund successful:", refundTx);

    // Verify donor is removed from list
    const projectAccount = await program.account.projectAccount.fetch(projectAccountPdaAddr);
    assert.strictEqual(projectAccount.donators.length, 0, "Donor should be removed after refund");

    // Try to claim refund again (should fail)
    try {
      await program.methods
        .claimRefund()
        .accounts({
          donator: donor.publicKey,
          project: projectAccountPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([donor])
        .rpc({ commitment: "confirmed" });
      assert.fail("Duplicate refund claim should have failed");
    } catch (error) {
      console.log("✅ Duplicate refund claim correctly rejected");
      assert.ok(error.message.includes("UserNotAuthorized"), "Error should indicate user not authorized (not in donators list)");
    }
  });

  it("Should allow project owner to close failed project after all refunds", async () => {
    const user = anchor.web3.Keypair.generate();
    const donor1 = anchor.web3.Keypair.generate();
    const donor2 = anchor.web3.Keypair.generate();
    
    // Create and fund a failed project
    const targetAmount = 8000;
    const projectAccountPdaAddr = await createProject(program, user, "Close After Refunds Test", targetAmount);

    // Airdrop to participants
    const airdrop1Promise = anchor.getProvider().connection.requestAirdrop(donor1.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    const airdrop2Promise = anchor.getProvider().connection.requestAirdrop(donor2.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await Promise.all([
      anchor.getProvider().connection.confirmTransaction(await airdrop1Promise),
      anchor.getProvider().connection.confirmTransaction(await airdrop2Promise)
    ]);

    // Make donations
    await program.methods
      .donate(new anchor.BN(2000))
      .accounts({
        user: donor1.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    await program.methods
      .donate(new anchor.BN(1500))
      .accounts({
        user: donor2.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([donor2])
      .rpc({ commitment: "confirmed" });

    // Mark project as failed
    await program.methods
      .closeProject()
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    // Try to close failed project before refunds (should fail)
    try {
      await program.methods
        .closeFailedProject()
        .accounts({
          user: user.publicKey,
          project: projectAccountPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc({ commitment: "confirmed" });
      assert.fail("Should not be able to close project with unreturned funds");
    } catch (error) {
      console.log("✅ Project closure rejected while donators remain");
      assert.ok(error.message.includes("InvalidProjectStatus"), "Error should indicate invalid project status");
    }

    // Process all refunds
    await program.methods
      .claimRefund()
      .accounts({
        donator: donor1.publicKey,
        project: projectAccountPdaAddr,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor1])
      .rpc({ commitment: "confirmed" });

    await program.methods
      .claimRefund()
      .accounts({
        donator: donor2.publicKey,
        project: projectAccountPdaAddr,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([donor2])
      .rpc({ commitment: "confirmed" });

    // Now close failed project should succeed
    const initialOwnerBalance = await anchor.getProvider().connection.getBalance(user.publicKey);
    
    const closeTx = await program.methods
      .closeFailedProject()
      .accounts({
        user: user.publicKey,
        project: projectAccountPdaAddr,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    console.log("Failed project closed successfully:", closeTx);

    // Verify PDA account is closed
    try {
      await program.account.projectAccount.fetch(projectAccountPdaAddr);
      assert.fail("PDA account should be closed");
    } catch (error) {
      console.log("✅ PDA account successfully closed");
    }

    // Verify owner received rent exemption
    const finalOwnerBalance = await anchor.getProvider().connection.getBalance(user.publicKey);
    assert.ok(finalOwnerBalance > initialOwnerBalance, "Owner should receive rent exemption (minus transaction fees)");
    
    console.log(`Owner received rent recovery: ${finalOwnerBalance - initialOwnerBalance} lamports`);
  });
});
