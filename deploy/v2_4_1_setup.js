// Enables ALLOW_ANY_NFT_CONTRACT_FOR_LINKING on IntelliLinkerV3: custom iNFT creation feature

// run: npx hardhat deploy --network goerli --tags v2_4_1_setup

// script is built for hardhat-deploy plugin:
// A Hardhat Plugin For Replicable Deployments And Easy Testing
// https://www.npmjs.com/package/hardhat-deploy

// we use assert to fail fast in case of any errors
const assert = require("assert");

// BN utils
const {
	toBN,
	print_amt,
} = require("../scripts/include/bn_utils");

// ACL token features and roles
const {
	FEATURE_LINKING,
	FEATURE_UNLINKING,
	FEATURE_ALLOW_ANY_NFT_CONTRACT_FOR_LINKING,
	FEATURE_ALLOW_ANY_NFT_CONTRACT_FOR_UNLINKING,
} = require("../scripts/include/features_roles");

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


	// IntelliLinkerV3: blacklist some target NFTs from being unlinked
	{
		// get the implementation deployment
		const deployment = await deployments.get("IntelliLinkerV3");

		// get proxy deployment details
		const {
			IntelliLinkerERC1967Proxy: proxy_deployment_address,
			TheRevenantsERC721: the_revenants_nft_address,
			SophiaBeingERC721: sophia_being_nft_address,
		} = await getNamedAccounts();

		// print deployment info
		await print_acl_details(A0, deployment.abi, proxy_deployment_address);

		// connect to the contract
		const web3_contract = new web3.eth.Contract(deployment.abi, proxy_deployment_address);
		const requested_permissions = [false, false, true, true]; // allowedForLinking, allowedForUnlinking, forbiddenForLinking, forbiddenForUnlinking
		const requested_bn = requested_permissions.reduce((p, c, i) => p.or(c? toBN(2).pow(toBN(i)): toBN(0)), toBN(0));
		console.log("requested permissions: %o (%o)", requested_permissions, requested_bn.toString(2));

		// for every NFT address to blacklist
		for(const nft_address of [the_revenants_nft_address, sophia_being_nft_address]) {
			// check if it correctly blacklisted
			const actual = toBN(await web3_contract.methods.whitelistedTargetContracts(nft_address).call());
			if(!actual.eq(requested_bn)) {
				// and blacklist if required
				const receipt = await web3_contract.methods.whitelistTargetContract(nft_address, ...requested_permissions).send({from: A0});
				console.log("IntelliLinkerERC1967Proxy.whitelistTargetContract(%o, %o): %o", nft_address, requested_bn.toString(2), receipt.transactionHash);
			}
		}
	}

	// IntelliLinkerV3: enable FEATURE_ALLOW_ANY_NFT_CONTRACT
	{
		// get the implementation deployment
		const deployment = await deployments.get("IntelliLinkerV3");

		// get proxy deployment details
		const {IntelliLinkerERC1967Proxy: proxy_deployment_address} = await getNamedAccounts();

		// print deployment info, and determine if required features are enabled
		const {features} = await print_acl_details(A0, deployment.abi, proxy_deployment_address);

		// verify if required features are enabled and enable if required
		const requested_features = toBN(FEATURE_LINKING | FEATURE_UNLINKING | FEATURE_ALLOW_ANY_NFT_CONTRACT_FOR_LINKING | FEATURE_ALLOW_ANY_NFT_CONTRACT_FOR_LINKING);
		if(!features.eq(requested_features)) {
			// update the features as required
			const web3_contract = new web3.eth.Contract(deployment.abi, proxy_deployment_address);
			const receipt = await web3_contract.methods.updateFeatures(requested_features).send({from: A0});
			console.log("IntelliLinkerERC1967Proxy.updateFeatures(%o): %o", requested_features.toString(2), receipt.transactionHash);
		}
	}
};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["v2_4_1_setup", "setup", "v2_4_1"];
