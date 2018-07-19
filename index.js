#!/usr/bin/env node

const colors = require('colors');
const request = require('request');
const Agent = require('socks5-https-client/lib/Agent');
const fs = require('fs');
const extend = require('extend');

var accBans = [], accLocks = [], accTemps = [], accGood = [],
	total, testFile,
	timeout = 20000;

function checkBan(userpass, proxy, callback) {
	var result = {
		banned: false,
		locked: false,
		temp: false,
		bandates: [],
		userpass: userpass
	};
	var [ user, pass ] = userpass.split(":");
	var proxyInfo = {
		jar: request.jar()
	};
	if (!proxy || proxy.trim() === "") {
		// No proxy
	} else if (proxy.indexOf("http") == 0) {
		proxyInfo.proxy = proxy;
	} else if (proxy.indexOf("socks") == 0) {
		var match = /socks:\/\/(([^:]+?):([^@]+)@)?([^:]+)(:([0-9]+))?\/?/gi.exec(proxy);
		var info = { socksHost: match[4] };
		if (match[2]) info.socksUsername = match[2];
		if (match[3]) info.socksPassword = match[3];
		if (match[6]) info.socksPort = parseInt(match[6]);
		proxyInfo.agent = new Agent(info);
	}
	request(extend({
		url: 'https://secure.runescape.com/m=weblogin/login.ws',
		method: 'POST',
		followAllRedirects: true,
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:61.0) Gecko/20100101 Firefox/61.0',
			'Referer': 'https://secure.runescape.com/m=weblogin/loginform.ws?mod=www&ssl=1&dest=community'
		},
		formData: {
			dest: 'community',
			mod: 'www',
			password: pass,
			ssl: '1',
			username: user
		}
	}, proxyInfo), function (e, response, body) {
		if (e)
			return callback(e, false, userpass);
		var match = body ? /\/c=([^/]+)\//g.exec(body) : [];
		if (!match || match.length < 2) {
			if (/To protect your security, your account has been locked./g.test(body)) {
				result.locked = true;
				callback(false, result);
			} else if (/You have been blocked from logging in/g.test(body)) {
				callback("Too many attempts! Slow it down!", false);
			} else if (/c-google-recaptcha-error--show/g.test(body)) {
				callback("Wants 2captcha now, cool off...", false);
			} else {
				callback("Unable to check this account!", false);
				// TODO Write this to file
				console.log(userpass, response.statusCode, body);
			}
			return;
		}
		var cValue = match[1];
		request(extend({
			url: 'https://secure.runescape.com/m=offence-appeal/c='+cValue+'/account_history.ws',
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:61.0) Gecko/20100101 Firefox/61.0',
				'Referer': 'https://www.runescape.com/c='+cValue+'/account_settings.ws'
			}
		}, proxyInfo), function (e, response, body) {
			if (e)
				return callback(e, false, userpass);
			if (!/Ban Meter/g.test(body)) {
				callback("Unable to check this accounts history!", false, userpass);
				return;
			}
			// Congratulations, you have no active offences on your account.
			result.temp = /Your account will be available./g.test(body);
			result.banned = /permanently banned/g.test(body);
			// parse out the bandates
			var regex = /<td>(([0-9]{1,2})-([A-Z][a-z]+)-20([0-9]{2}))<\/td>/g;
			var match;
			while (match = regex.exec(body)) {
				result.bandates.push(match[1]);
			}
			callback(false, result);
		})
	})
}

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
			process.stdout.write("\n"+colors.green.inverse("          DONE!         ")+"\n");
			var combo = [...accLocks, ...accBans];
			if (accGood.length > 0)
				fs.writeFileSync(testFile+".active", accGood.join("\r\n"));
			if (accTemps.length > 0)
				fs.writeFileSync(testFile+".2day", accTemps.join("\r\n"));
			if (combo.length > 0)
				fs.writeFileSync(testFile+".banned", combo.join("\r\n"));
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
		var failTimeout = setTimeout(function () {
			failsafed = true;
			resolve();
		}, 20000);
		checkBan(userpass, proxy, function (err, result, userpass) {
			if (failsafed) return; // Invalid req now
			clearTimeout(failTimeout);
			if (err) {
				resolve();
				return;
			}
			banChecks.splice(banChecks.indexOf(result.userpass), 1);

			var clearStr = "";
			for (var i = 0; i < process.stdout.columns - 2; i++)
				clearStr += " ";
			process.stdout.write("\r"+clearStr+"\r");
			var tag = result.userpass+" "+result.bandates.join(", ");

			if (result.banned) {
				accBans.push("BANNED "+result.userpass
					+"  Offense date(s): "+result.bandates.join(", "));
				process.stdout.write(colors.red.inverse.bold("BANNED")+"   "+tag);
			} else if (result.temp)  {
				accTemps.push(result.userpass);
				process.stdout.write(colors.yellow.inverse.bold(" TEMP ")+"   "+tag);
			} else if (result.locked) {
				accLocks.push("LOCKED "+result.userpass);
				process.stdout.write(colors.blue.inverse.bold("LOCKED")+"   "+tag);
			} else {
				accGood.push(result.userpass);
				process.stdout.write(colors.green.inverse.bold("ACTIVE")+"   "+tag);
			}

			var perc = ""+((accGood.length/(total-banChecks.length))*100),
				percind = perc.indexOf(".");
			if (percind > -1)
				perc = perc.substr(0, percind);

			var output = "\n"+
				colors.inverse.cyan.bold("  QuantumShop.co  ")+" "+
				colors.white.inverse.bold((total-banChecks.length)+"/"+total)+" "+
				colors.green.inverse.bold("ACTIVE:"+accGood.length)+" "+
				colors.inverse.bold.red("BANNED:"+accBans.length)+" "+
				colors.inverse.bold.blue("LOCKED:"+accLocks.length)+" "+
				colors.inverse.bold.yellow("TEMP:"+accTemps.length)+" "+
				colors.inverse.bold.cyan("ACTIVE%:"+perc);
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

	process.stdout.write(colors.inverse.cyan.bold("  QuantumShop.co  ")+" Starting...");

	processAccs();
}

process.on('exit', function () {
	console.log(""); // new line
}) //*/
