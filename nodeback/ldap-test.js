require('dotenv').config();
const ActiveDirectory = require('activedirectory2');

const adConfig = {
  url: process.env.LDAP_URL,
  baseDN: process.env.LDAP_BASE_DN,
  username: process.env.LDAP_USER,
  password: process.env.LDAP_PASSWORD
};

const ad = new ActiveDirectory(adConfig);

const testUsername = "j904336@rheinberg.krzn.de";
const testPassword = 'auto';

ad.authenticate(testUsername, testPassword, (err, auth) => {
  if (err) {
    console.error('[LDAP ERROR]', err);
    return;
  }
  if (auth) {
    console.log('LDAP Auth erfolgreich!');
    ad.findUser(testUsername, (err, user) => {
      if (err) return console.error('[LDAP FIND USER ERROR]', err);
      setInterval(() => {
        console.log('User-Daten:', user);
      }, 500)
    });
  } else {
    console.log('LDAP Auth fehlgeschlagen - falscher Nutzername oder Passwort');
  }
});