// deploy: npx hardhat deploy --network mumbai --tags v2_5_1_deploy_polygon
// verify: npx hardhat etherscan-verify --network mumbai

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

	// ensure we're not deploying into the wrong place
	assert(
		network.name === "hardhat"
		|| network.name === "localhost"
		|| network.name === "polygon"
		|| network.name === "polygon2"
		|| network.name === "mumbai",
		"unsupported network: please make sure you're deploying into Polygon"
	);

	// ERC721
	{
		// deploy if required
		await deployments.deploy("PolygonDigitalTwin", {
			// address (or private key) that will perform the transaction.
			// you can use `getNamedAccounts` to retrieve the address you want by name.
			from: A0,
			contract: "WhitelabelNFT",
			// the list of argument for the constructor (or the upgrade function in case of proxy)
			args: ["Digital Twins", "TWIN"],
			// if set it to true, will not attempt to deploy even if the contract deployed under the same name is different
			skipIfAlreadyDeployed: true,
			// if true, it will log the result of the deployment (tx hash, address and gas used)
			log: true,
		});

		// get deployment details
		const deployment = await deployments.get("PolygonDigitalTwin");

		// print deployment details
		await print_nft_acl_details(A0, deployment.abi, deployment.address);
	}

};

// Tags represent what the deployment script acts on. In general, it will be a single string value,
// the name of the contract it deploys or modifies.
// Then if another deploy script has such tag as a dependency, then when the latter deploy script has a specific tag
// and that tag is requested, the dependency will be executed first.
// https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies
module.exports.tags = ["v2_5_1_deploy_polygon", "deploy_polygon", "v2_5_1"];
