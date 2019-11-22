#!/usr/bin/env node
const colors = require('colors');
const fs = require('fs');
const checkBan = require('./index.js');

let options = {};

if (!fs.existsSync('./options.json')) {
	console.log("Failed to load ban checker, no options.json!");
} else {
	options = JSON.parse(fs.readFileSync('./options.json'));
}

if (!fs.existsSync('./proxies.txt')) {
	console.log("Failed to load proxies.txt, will be single threaded and slow...");
}

var accBans = [], accLocks = [], accTemps = [], accGood = [],
	total, testFile,
	timeout = 90000;

function shuffle(a) {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function processAccs() {
	var startTime = new Date().getTime();
	var promises = [];
	// Do 5 every 15 seconds?
	shuffle(proxies);
	for (var i = 0; i < proxies.length; i++) {
		if (i >= banChecks.length)
			continue;
		promises.push(processAcc(banChecks[i], proxies[i]));
	}
	Promise.all(promises).then(function (results) {
		if (banChecks.length == 0) {
			// TODO Write to file?
			process.stdout.write("\n" + colors.green.inverse("          DONE!         ") + "\n");
			var combo = [...accLocks, ...accBans];
			if (accGood.length > 0)
				fs.writeFileSync(testFile + ".active", accGood.join("\r\n"));
			if (accTemps.length > 0)
				fs.writeFileSync(testFile + ".2day", accTemps.join("\r\n"));
			if (combo.length > 0)
				fs.writeFileSync(testFile + ".banned", combo.join("\r\n"));
			process.exit();
		} else {
			setTimeout(function () {
				processAccs();
			}, timeout - (new Date().getTime() - startTime));
		}
	})
}

function processAcc(userpass, proxy) {
	var failsafed;

	return new Promise(function (resolve, reject) {
		checkBan(userpass, proxy, options, function (err, result, userpass) {
			if (failsafed) return; // Invalid req now
			if (err) {
				process.stdout.write("\r" + err + "\r");
			} else {
				banChecks.splice(banChecks.indexOf(result.userpass), 1);

				var clearStr = "";
				for (var i = 0; i < process.stdout.columns - 2; i++)
					clearStr += " ";
				process.stdout.write("\r" + clearStr + "\r");
				var tag = result.userpass + " " + result.bandates.join(", ");

				if (result.banned) {
					accBans.push("BANNED " + result.userpass
						+ "  Offense date(s): " + result.bandates.join(", "));
					process.stdout.write(colors.red.inverse.bold("BANNED") + "   " + tag);
				} else if (result.baduser) {
					accBans.push("INVALD " + result.userpass);
					process.stdout.write(colors.gray.inverse.bold("INVALD") + "   " + tag);
				} else if (result.temp) {
					accTemps.push(result.userpass);
					process.stdout.write(colors.yellow.inverse.bold(" TEMP ") + "   " + tag);
				} else if (result.locked) {
					accLocks.push("LOCKED " + result.userpass);
					process.stdout.write(colors.blue.inverse.bold("LOCKED") + "   " + tag);
				} else {
					accGood.push(result.userpass);
					process.stdout.write(colors.green.inverse.bold("ACTIVE") + "   " + tag);
				}
			}

			var perc = "" + ((accGood.length / (total - banChecks.length)) * 100),
				percind = perc.indexOf(".");
			if (percind > -1)
				perc = perc.substr(0, percind);

			var output = "\n" +
				colors.inverse.cyan.bold("  QuantumShop.co  ") + " " +
				colors.white.inverse.bold((total - banChecks.length) + "/" + total) + " " +
				colors.green.inverse.bold("ACTIVE:" + accGood.length) + " " +
				colors.inverse.bold.red("BANNED:" + accBans.length) + " " +
				colors.inverse.bold.blue("LOCKED:" + accLocks.length) + " " +
				colors.inverse.bold.yellow("TEMP:" + accTemps.length) + " " +
				colors.inverse.bold.cyan("ACTIVE%:" + perc);
			process.stdout.write(output);

			resolve();
		});
	});
}

testFile = process.argv[process.argv[0].indexOf("node") > -1 ? 2 : 1];
if (testFile === "help" || !testFile) {
	console.log(colors.cyan.inverse(
		"                        QuantumShop.co Ban Checker                        "));
	console.log("See https://github.com/Lem0ns/quantum-ban-check for help!");
} else {
	if (fs.existsSync("./proxies.txt")) {
		proxies = fs.readFileSync('./proxies.txt').toString().trim().split("\n").map((s) => s.trim());
	} else {
		proxies = [];
	}
	banChecks = fs.readFileSync(testFile).toString()
		.trim().split("\n").map((s) => s.trim());
	total = banChecks.length;
	proxies = proxies.filter((p) => p.trim().length > 0);
	if (proxies.length == 0)
		proxies = [false];

	process.stdout.write(colors.inverse.cyan.bold("  QuantumShop.co  ") + " Starting...");

	processAccs();
}

process.on('exit', function () {
	console.log(""); // new line
}) //*/
