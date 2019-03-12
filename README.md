# ExampleWorkGoogleCloudFunctions
NOTE: As Google Cloud Functions have made it possible to use NodeJS8 by April 1 2019, this code will all be refactored to Async/Await. Please forgive my use of multiple nested promises.

A demonstration of my coding with NodeJS and Firebase/Firestore. The Cloud Function create an account in Firebase for a user of the ExampleApp (https://github.com/phbn/ExampleAppExpoReactNative-app). This is possible through a simple e-mail sign up, or signing in with LinkedIn. The code I bootstrapped together to enable my previous company to integrate their React Native app with LinkedIn, due to a lack of solutions made possible by Microsoft and the community as whole. Furthermore, the code saves the LinkedIn users information to Firebase for later marketing purposes.
