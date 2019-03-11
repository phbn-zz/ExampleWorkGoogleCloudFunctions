const functions = require("firebase-functions");
const admin = require("firebase-admin");
const createUser = require("./createUser");
const crypto = require("crypto");

const OAUTH_SCOPES = ["r_basicprofile", "r_emailaddress"];

/**
 * Creates a configured LinkedIn API Client instance.
 */
function linkedInClient() {
  // LinkedIn OAuth 2 setup
  // TODO: Configure the `linkedin.client_id` and `linkedin.client_secret` Google Cloud environment variables.
  return require("node-linkedin")(
    functions.config().linkedin.client_id,
    functions.config().linkedin.client_secret,
    `https://github.com/phbn/AuthExampleWithFirebase`
  );
}

const Linkedin = linkedInClient();

exports.makeStateString = (req, res) => {
  const state = crypto.randomBytes(20).toString("hex");

  console.log("Setting verification state and saving to Firestore: ", state);

  let states = { state: state.toString() };

  states.stateCreatedAt = admin.firestore.FieldValue.serverTimestamp();

  admin
    .firestore()
    .collection("authStatesLI")
    .doc(state.toString())
    .set(states)
    .then(() => {
      return res.send({ status: 200, data: state });
    })
    .catch(e => {
      return res.send({ e });
    });
};

exports.createLIUserWithPhone = (req, res) => {
  // Retrieving LinkedIn data from temp Firestore
  let linkedInData;

  admin
    .firestore()
    .collection("authStatesLI")
    .doc(req.body.data.ref)
    .get()
    .then(doc => {
      if (!doc.exists) {
        console.log("No such document!");
        return res.status(200).send({ status: 200, data: "Missing LI Data" });
      } else if (doc.data().linkedInData.emailAddress === undefined) {
        return res
          .status(200)
          .send({ status: 200, data: "Email missing from LinkedIn" });
      } else {
        console.log("Document data:", doc.data());
        linkedInData = doc.data().linkedInData;
      }
      return linkedInData;
    })
    .then(linkedInData => {
      console.log(linkedInData);
      const data = {
        email: linkedInData.emailAddress,
        password: crypto.randomBytes(10).toString("hex"),
        first_name: linkedInData.firstName,
        last_name: linkedInData.lastName,
        phone: req.body.data.phone
      };
      console.log(data);

      // Creating user with phone number retrieved from client
      return createFirebaseUser(linkedInData, data, req).then(result => {
        // Delete temp data from Firestore
        admin
          .firestore()
          .collection("authStatesLI")
          .doc(data.email)
          .delete()
          .then(console.log("Temp LinkedIn data deleted"))
          .catch(e => {
            return e;
          });

        console.log("Returning customToken to App");
        return res.status(200).send({ status: 200, data: result });
      });
    })
    .catch(error => {
      return res.status(400).send({ status: 400, error });
    });
};

// Root function which handles sign up process
exports.LISignInSignUp = (req, res) => {
  const state = req.body.data.stateString;

  // Checking timestamp against Firestore timestamp for state to ensure security
  stateCheck(state)
    .then(result => {
      if (result === "CSRF") {
        return res
          .status(200)
          .send({
            status: 200,
            data: { result: result }
          })
          .catch(error => {
            return res.status(400).send({ status: 400, error });
          });
      } else {
        Linkedin.auth.authorize(OAUTH_SCOPES, state); // makes sure the state parameter is set as a formality for node-linkedIn library

        // Begin fetching access token from LinkedIn API
        console.log("Fetching access token by submitting state and authCode");
        return Linkedin.auth.getAccessToken(
          res,
          req.body.data.authCode,
          state,
          (error, results) => {
            if (error) {
              console.log(error)
              throw error;
            }
            console.log("Received Access Token:", results.access_token);
            const linkedin = Linkedin.init(results.access_token);
            linkedin.people.me((error, userResults) => {
              if (error) {
                throw error;
              }
              console.log(
                "Access token exchange result received: ",
                userResults
              );

              // Delete state from Firestore
              admin
                .firestore()
                .collection("authStatesLI")
                .doc(state)
                .delete()
                .then(console.log("Temp auth state cleared"))
                .catch(error => {
                  return res.status(400).send({ status: 400, error });
                });

              // We have a LinkedIn access token and the user identity now.
              // We define the object needed for to create user

              const linkedInData = userResults;

              data = {
                email: userResults.emailAddress,
                password: crypto.randomBytes(10).toString("hex"),
                phone: userResults.phoneNumbers,
                first_name: userResults.firstName,
                last_name: userResults.lastName
              };

              console.log(data);
              console.log(linkedInData);

              return createFirebaseUser(linkedInData, data, req)
                .then(result => {
                  if (result === "phoneNumberNeeded") {
                    return res.status(200).send({
                      status: 200,
                      data: { result: result, ref: data.email }
                    });
                  } else {
                    console.log(
                      "Returning result (customToken or Phone request) to App"
                    );
                    return res
                      .status(200)
                      .send({ status: 200, data: { result: result } });
                  }
                })
                .catch(error => {
                  return res.status(400).send({ status: 400, error });
                });
            });
          }
        );
      }
    })
    .catch(error => {
      return res.status(400).send({ status: 400, error });
    });
};

// We create or update the user authentication within Firebase with our new info, and then save linkedIn data to Firestore
function createFirebaseUser(linkedInData, data, req) {
  return new Promise((resolve, reject) => {
    admin
      .auth()
      .getUserByEmail(data.email)
      .then(userResults => {
        console.log("UID found for LinkedIn email: " + userResults.uid);
        console.log("Updating user with info from LinkedIn...");
        return admin
          .auth()
          .updateUser(userResults.uid, {
            photoURL: linkedInData.pictureUrls.values[0]
          })
          .then(userResults => {
            admin
              .firestore()
              .collection("users")
              .doc(userResults.uid)
              .set(
                {
                  profile: {
                    linkedInUrl: linkedInData.publicProfileUrl,
                    visible: true
                  }
                },
                { merge: true }
              );
            const uid = userResults.uid;
            return resolve(createCustomToken(uid, linkedInData));
          })
          .catch(e => {
            console.log(e);
          });
      })
      .catch(() => {
        console.log("LinkedIn email not found in database. Creating user...");
        admin
          .firestore()
          .collection("authStatesLI")
          .doc(data.email)
          .set({ linkedInData })
          .then(() => {
            return resolve("phoneNumberNeeded");
          })
          .catch(error => {
            console.error(error);
            reject(error);
          });
      });
  });
}

// Create a Firebase custom auth token and respond to app for user login
function createCustomToken(uid, linkedInData) {
  return new Promise((resolve, reject) => {
    admin
      .auth()
      .createCustomToken(uid)
      .then(customToken => {
        console.log(linkedInData);
        saveDataToFirestore(uid, linkedInData);
        console.log(
          "Created Custom token for UID: ",
          uid,
          '" Token:',
          customToken
        );
        return resolve(customToken);
      })
      .catch(e => {
        console.error(e);
        reject(e);
      });
  });
}

//Save LinkedIn data to Firestore
function saveDataToFirestore(uid, linkedInData) {
  console.log("Saving LinkedIn Firestore with UID: " + uid);
  return admin
    .firestore()
    .collection("users")
    .doc(uid)
    .set({ linkedInData }, { merge: true })
    .catch(error => {
      throw error;
    })
    .then(() => {
      return admin
        .firestore()
        .collection("users")
        .doc(uid)
        .get()
        .then(doc => {
          admin
            .firestore()
            .collection("users")
            .doc(uid)
            .set(
              {
                profile: {
                  linkedInUrl: linkedInData.publicProfileUrl,
                  visible: true
                }
              },
              { merge: true }
            );
          if (!doc().profile.intro) {
            let intro = linkedInData.summary
              ? linkedInData.summary.substring(0, 120)
              : "Something you would like to talk about...";
            admin
              .firestore()
              .collection("users")
              .doc(uid)
              .set(
                {
                  profile: {
                    intro: intro
                  }
                },
                { merge: true }
              );
          }
          if (!doc().profile.headline) {
            let headline = linkedInData.headline ? linkedInData.headline : "";
            admin
              .firestore()
              .collection("users")
              .doc(uid)
              .set(
                {
                  profile: {
                    headline: headline
                  }
                },
                { merge: true }
              );
          }
          if (!doc().profile.industry) {
            let industry = linkedInData.industry ? linkedInData.industry : "";
            admin
              .firestore()
              .collection("users")
              .doc(uid)
              .set(
                {
                  profile: {
                    industry: industry
                  }
                },
                { merge: true }
              );
          }
          return null;
        });
    });
}

//Security check with state
function stateCheck(state) {
  return new Promise((resolve, reject) => {
    admin
      .firestore()
      .collection("authStatesLI")
      .doc(state.toString())
      .get()
      .then(doc => {
        let permittedTimeFrame = new Date();
        permittedTimeFrame.setMinutes(permittedTimeFrame.getMinutes() - 5);

        if (doc.data().stateCreatedAt < permittedTimeFrame) {
          console.log("Possible CSRF attack detected");
          return resolve("CSRF");
        } else {
          return resolve(console.log("State matches Firestore state"));
        }
      })
      .catch(e => {
        return reject(e);
      });
  });
}
