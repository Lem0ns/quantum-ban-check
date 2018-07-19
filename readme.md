# Installation

Install Node.JS for your OS, then in a command prompt or terminal run:

```
npm install -g git+https://github.com/Lem0ns/quantum-ban-check.git
```

# Running the program
Save your accounts in `username:password` line separated format to a txt file,
for example accs.txt. Then run:
```
$quantum-ban-check accs.txt

The accounts will be checked, and saved into files depending on status:
- Unbanned accounts goes to filename.txt.active
- 2 day bans go to filename.txt.2day
- Locked and Banned accs go to filename.txt.disabled with extra info

# Proxies

For proxies, create `proxies.txt` in the current directory.
Add one proxy per line, valid proxy types are http, https, and socks5.
Examples:
```
http://localhost/
https://localhost:8080/
socks://user:pass@localhost:8080/
```

That sums up how to use this program. Have fun!
