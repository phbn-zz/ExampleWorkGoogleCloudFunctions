const admin = require("firebase-admin");
const functions = require("firebase-functions");

//In here we can nest other 3rd party payment apps as solution for customer handling

exports.createCustomer = customer => {
  // Example input: {"message": "Hello!"}
  if (customer === undefined) {
    // This is an error case, as "message" is required.
    console.log("customer data not found in request");
    return res.status(400).send("no data specified");
  } else {
    return createCustomerAsFirebaseUser(customer);
  }
};

createCustomerAsFirebaseUser = customer => {
  //sanitizes the customer data according to the countrycode detected for the user
  if (customer.phone.startsWith("00"))
    customer.phone = customer.phone.replace("00", "+");
  if (!customer.phone.includes("+")) customer.phone = "+45" + customer.phone;

  return new Promise((resolve, reject) => {
    let hiddenpass = customer.password;
    customer.password = "****";
    console.log("creating customer as firebase user", customer);
    admin
      .auth()
      .createUser({
        email: customer.email,
        emailVerified: true,
        phoneNumber: customer.phone,
        password: hiddenpass,
        displayName: customer.first_name + " " + customer.last_name,
        disabled: false
      })
      .then(userRecord => {
        admin
        .firestore()
        .collection("users")
        .doc(userRecord.uid)
        .set(
          {
            profile: {
              visible: true,
              firstName: customer.first_name,
              lastName: customer.last_name,
              email: customer.email,
              headline: 'Unknown'
            }
          },
          { merge: true }
        );
        console.log("user created in firebase: " + userRecord);
        return resolve(userRecord);
      })
      .catch(error => {
        return reject(error);
      });
  });
};
