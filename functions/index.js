const functions = require("firebase-functions");
const admin = require("firebase-admin");

const createUser = require("./createUser");
const LISignInSignUp = require("./LISignInSignUp");

admin.initializeApp();

//Avoid firebase error message
const firestore = admin.firestore();
firestore.settings({ timestampsInSnapshots: true });

const region = "us-central1";

/** User management */
exports.createUser = functions.region(region).https.onCall(data => {
  let customer = data.customer;
  return createUser.createCustomer(customer);
});

/** LinkedIn Auth */
exports.LISignInSignUp = functions
  .region(region)
  .https.onRequest((req, res) => {
    LISignInSignUp.LISignInSignUp(req, res);
  });

exports.createLIUserWithPhone = functions
  .region(region)
  .https.onRequest((req, res) => {
    LISignInSignUp.createLIUserWithPhone(req, res);
  });

exports.makeStateString = functions
  .region(region)
  .https.onRequest((req, res) => {
    LISignInSignUp.makeStateString(req, res);
  });
