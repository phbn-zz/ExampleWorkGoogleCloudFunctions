const admin = require("firebase-admin");
const functions = require("firebase-functions");

//In here we can nest other 3rd party payment apps as solution for customer handling

_createCustomerAsFirebaseUser = customer => {
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
      .then(() => {
        return console.log("user was created in google");
      })
      .catch(error => {
        console.error(
          "caught an error trying to create new user",
          customer,
          error
        );
        reject(error);
      });
  });
};
