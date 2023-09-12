import { BiconomySmartAccount } from "@biconomy/account";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { USDC_CONTRACT_ADDRESS, ERC20ABI } from "@/constants";
import {
    IHybridPaymaster,
    PaymasterMode,
    SponsorUserOperationDto,
} from "@biconomy/paymaster"

export default function Transfer({ smartAccount }: { smartAccount: BiconomySmartAccount }) {
    const [smartContractAddress, setSmartContractAddress] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [amount, setAmount] = useState(0);
    const [recipient, setRecipient] = useState("");

    // async function getSmartContractAddress() {
    //     const smartContractAddress = await smartAccount.getSmartAccountAddress();
    //     setSmartContractAddress(smartContractAddress);
    // }

    async function getSmartContractAddress() {
        const smartContractAddress = await smartAccount.getSmartAccountAddress();
        setSmartContractAddress(smartContractAddress);
    }
    // Get the address of the smart contract when the component loads
    useEffect(() => {
        getSmartContractAddress();
    }, []);

    async function performTransfer() {
        try {
            // initialize the loading state
            const readProvider = smartAccount.provider;
            const tokenContract = new ethers.Contract(
                USDC_CONTRACT_ADDRESS,
                ERC20ABI,
                readProvider
            );

            // fetch the amount of decimals in this ERC20 contract
            const decimals = await tokenContract.decimals();

            // convert the user inputted amount to the proper denomination unit based on the token
            const amountInLowestUnit = ethers.utils.parseUnits(
                amount.toString(),
                decimals
            );

            // create the calldata for our userOperation
            const populatedTransferTxn = await tokenContract.populateTransaction.transfer(
                recipient,
                amountInLowestUnit
            );
            const calldata = populatedTransferTxn.data;

            //build the userOperation
            const userOp = await smartAccount.buildUserOp([
                {
                    to: USDC_CONTRACT_ADDRESS,
                    data: calldata,
                },
            ]);

            // Get the paymaster fee from biconomy
            const biconomyPaymaster = smartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;
            const feeQuoteResponse = await biconomyPaymaster.getPaymasterFeeQuotesOrData(userOp, {
                mode: PaymasterMode.ERC20,
                tokenList: [],
                preferredToken: USDC_CONTRACT_ADDRESS,
            });
            const feeQuote = feeQuoteResponse.feeQuotes;
            if (!feeQuote) throw new Error("Could not fetch fee quote in USDC");

            const spender = feeQuoteResponse.tokenPaymasterAddress || "";
            const selectedFeeQuote = feeQuote[0];

            // Build the paymaster userOp
            let finalUserOp = await  smartAccount.buildTokenPaymasterUserOp(userOp, {
                feeQuote: selectedFeeQuote,
                spender: spender,
                maxApproval: true,
            });

            // get the calldata for the paymaster
            const paymasterServiceData = {
                mode: PaymasterMode.ERC20,
                feeeTokenAddress: USDC_CONTRACT_ADDRESS,
                calculateGasLimit: true,
            };
            
            const paymasterAndDataResponse = await biconomyPaymaster.getPaymasterAndData(
                finalUserOp,
                paymasterServiceData
            );
            finalUserOp.paymasterAndData = paymasterAndDataResponse.paymasterAndData;

            if (
                paymasterAndDataResponse.callGasLimit &&
                paymasterAndDataResponse.verificationGasLimit &&
                paymasterAndDataResponse.preVerificationGas
            ) {
                // Returned gas limits must be replaced in your op as you update paymasterAndData
                // Because these are the limits paymaster service signed on to generate paymasterAndData
                finalUserOp.callGasLimit = paymasterAndDataResponse.callGasLimit;
                finalUserOp.verificationGasLimit = paymasterAndDataResponse.verificationGasLimit;
                finalUserOp.preVerificationGas = paymasterAndDataResponse.preVerificationGas;
            }

            // send the userOperation
            const userOpResponse = await smartAccount.sendUserOp(finalUserOp);
            const receipt = await userOpResponse.wait();

            console.log(`Transaction receipt: ${JSON.stringify(receipt, null, 2)}`);
            window.alert("Transaction successful!");
        } catch (error) {
            console.error(error);
            window.alert("Transaction failed. Please check the console for error.")
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div>
            <p className="text-sm">
                {" "}
                Your smart account address is: {smartContractAddress}
            </p>
            {isLoading ? (
                <div>Loaoding...</div>
            ) : (
                <div>
                    <p>Transfer tokens from your account to another :</p>
                    <div className="mt-5 flex w-auto flex-col gap-2">
                        <input className="rounded-x1 border-2 p-1 text-grat-500"
                            type="text"
                            placeholder="Enter Address"
                            onChange={(e) => setRecipient(e.target.value)}
                        />
                        <input
                            className="rounded-x1 border-2 p-1 text-gray-500"
                            type="number"
                            placeholder="Enter amount"
                            onChange={(e) => setAmount(Number(e.target.value))}
                        />
                        <button 
                            className="w-32 rounded-lg bg-gradient-to-r from-green-400 to-blue-500 px-4 py-2 font-medium transition-all hover:from-green-500 hover:to-blue-600"
                            onClick={performTransfer}
                        >
                            Transfer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}