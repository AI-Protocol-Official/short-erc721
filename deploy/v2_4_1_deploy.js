// Deploys IntelliLinkerV3 and upgrades IntelliLinkerV2 (ERC1967 Proxy) to IntelliLinkerV3

// deploy: npx hardhat deploy --network goerli --tags v2_4_1_deploy
// verify: npx hardhat etherscan-verify --network goerli

// script is built for hardhat-deploy plugin:
// A Hardhat Plugin For Replicable Deployments And Easy Testing
// https://www.npmjs.com/package/hardhat-deploy

// BN utils
const {
	toBN,
	print_amt,
} = require("../scripts/include/bn_utils");

// deployment utils (contract state printers)
const {
	print_erc20_acl_details,
	print_nft_acl_details,
	print_acl_details,
} = require("../scripts/deployment_utils");

// to be picked up and executed by hardhat-deploy plugin
module.exports = async function({deployments, getChainId, getNamedAccounts, getUnnamedAccounts}) {
	// print some useful info on the account we're using for the deployment
	const chainId = await getChainId();
	const [A0] = await web3.eth.getAccounts();
	let nonce = await web3.eth.getTransactionCount(A0);
	let balance = await web3.eth.getBalance(A0);

	// print initial debug information
	console.log("network %o %o", chainId, network.name);
	console.log("service account %o, nonce: %o, balance: %o ETH", A0, nonce, print_amt(balance));


	// Implementation
	{
		// deploy if required
		await deployments.deploy("IntelliLinkerV3", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "IntelliLinkerV3",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			// args: [],
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("IntelliLinkerV3");

		// print deployment details
		await print_acl_details(A0, deployment.abi, deployment.address);
	}

	// Upgrade
	{
		// get implementation deployment details
		const impl_deployment = await deployments.get("IntelliLinkerV3");
		const impl_contract = new web3.eth.Contract(impl_deployment.abi, impl_deployment.address);
		// get proxy deployment details
		const {IntelliLinkerERC1967Proxy: proxy_deployment_address} = await getNamedAccounts();
		// print proxy deployment details
		await print_acl_details(A0, impl_deployment.abi, proxy_deployment_address);

		// prepare the upgradeTo call bytes
		const proxy_upgrade_data = impl_contract.methods.upgradeTo(impl_deployment.address).encodeABI();

		// update the implementation address in the proxy
		// TODO: do not update if already updated
		const tx_receipt = await deployments.rawTx({
			from: A0,
			to: proxy_deployment_address,
			data: proxy_upgrade_data, // upgradeTo(impl_deployment.address)
		});
		console.log("IntelliLinkerERC1967Proxy.upgradeTo(%o): %o", impl_deployment.address, tx_receipt.transactionHash);
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["v2_4_1_deploy", "deploy", "v2_4_1"];
