const request = require('request');
const Agent = require('socks5-https-client/lib/Agent');
const extend = require('extend');

module.exports = function checkBan(userpass, proxy, callback) {
	var origCallback = callback;
	var calledBack = false;
	var th1s = this;
	var result = {
		banned: false,
		locked: false,
		baduser: false,
		temp: false,
		bandates: [],
		userpass: userpass
	};
	callback = function () {
		if (calledBack)
			return;
		calledBack = true;
		clearTimeout(failTimeout);
		origCallback.apply(this, arguments);
	}
	var failTimeout = setTimeout(function () {
		failsafed = true;
		callback("Timed out", false);
	}, 120000);
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
		var match = /\/c=([^/]+)\//g.exec(response.request.uri.pathname);
		if (!match || match.length < 2)
			match = body ? /\/c=([^/]+)\//g.exec(body) : [];
		if (!match || match.length < 2) {
			if (/To protect your security, your account has been locked./g.test(body)) {
				result.locked = true;
				callback(false, result);
			} else if (/You have been blocked from logging in/g.test(body)) {
				callback("Too many attempts! Slow it down!", false);
			} else if (/Your login or password was incorrect./g.test(body)) {
				result.baduser = true;
				callback(false, result);
			} else if (/c-google-recaptcha-error--show/g.test(body)
					|| /Please complete the reCAPTCHA box./g.test(body)) {
				callback("Wants recaptcha, cool off...", false);
			} else if (/Sorry, this part of the website is currently unavailable./g.test(body)) {
				callback("Service is unavailable for this IP, cool off...", false);
			} else {
				console.log(userpass, response.statusCode, body);
				callback("Unable to check this account!", false);
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
