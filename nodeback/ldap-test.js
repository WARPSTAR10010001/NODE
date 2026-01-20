require('dotenv').config();
const ActiveDirectory = require('activedirectory2');

const adConfig = {
  url: process.env.LDAP_URL,
  baseDN: process.env.LDAP_BASE_DN,
  username: process.env.LDAP_USER,
  password: process.env.LDAP_PASSWORD
};

const ad = new ActiveDirectory(adConfig);

// Test-LDAP-Login
const testUsername = "M120D1S8\\j904336";  // Ersetze mit einem echten AD-Nutzer
const testPassword = 'magnesium47495';       // Passwort des AD-Nutzers

ad.authenticate(testUsername, testPassword, (err, auth) => {
  if (err) {
    console.error('[LDAP ERROR]', err);
    return;
  }
  if (auth) {
    console.log('✅ LDAP Auth erfolgreich!');
    // optional: Benutzerinfos auslesen
    ad.findUser(testUsername, (err, user) => {
      if (err) return console.error('[LDAP FIND USER ERROR]', err);
      console.log('User-Daten:', user);
    });
  } else {
    console.log('❌ LDAP Auth fehlgeschlagen – falscher Nutzername oder Passwort');
  }
});