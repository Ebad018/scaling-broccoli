const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});
// const bodyParser = require("body-parser");

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// List of phone numbers
const phoneNumbers = [
  "+923145353012", // Phone number 1
  "+923058777434", // Phone number 2
];


// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING

// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING

// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING


// CLOUD FUNCTIONS FOR TWILIO


// Cloud function to return phone numbers in a round-robin way with CORS support
exports.getNextPhoneNumber = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      // Get the current index from Firestore
      const docRef = db.collection("RoundRobin").doc("currentIndex");
      const doc = await docRef.get();

      let currentIndex = 0;

      if (doc.exists) {
        currentIndex = doc.data().index;
      } else {
        // Initialize the index if the document doesn't exist
        await docRef.set({index: 0});
      }

      // Get the current recipient phone number based on the index
      const recipientNumber = phoneNumbers[currentIndex];

      // Update the index for the next number in round-robin
      currentIndex = (currentIndex + 1) % phoneNumbers.length;
      // Round-robin logic
      await docRef.update({index: currentIndex});

      const formattedNumber = recipientNumber.trim();

      // Send the phone number as a response
      res.status(200).send(formattedNumber);
    } catch (error) {
      console.error("Error retrieving phone number:", error);
      res.status(500).send("Error retrieving phone number");
    }
  });
});

// FUNCTION TO GET WARRANTY DETAILS THROUGH WHATSAPP


/**
 * Function to get warranty details from Firestore
 *  based on the last 10 digits of a phone number.
 * @param {Object} req - The HTTP request object from Twilio.
 * @param {Object} res - The HTTP response object to send back warranty details.
 * @returns {void}
 */

exports.getWarrantyDetails = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    const phoneNumber = req.body.phoneNumber; // Extract phone number from body

    if (!phoneNumber || phoneNumber.length < 10) {
      res.status(400).send("Phone number is required");
      return;
    }

    try {
      // Extract the last 10 digits of the phone number
      const last10Digits = phoneNumber.slice(-10);

      const customersRef = admin.firestore().collection("Customers");
      const customersSnapshot = await customersRef.get();

      if (customersSnapshot.empty) {
        res.status(404).send("No customer found with this phone number.");
        return;
      }

      let customerFound = false;
      let customerDoc = null;

      // Iterate over the customers to find a match for the last 10 digits
      customersSnapshot.forEach((doc) => {
        const customerPhone = doc.data().phone;

        if (customerPhone && customerPhone.slice(-10) === last10Digits) {
          customerFound = true;
          customerDoc = doc;
        }
      });

      if (!customerFound || !customerDoc) {
        res.status(404).send("No customer found with this phone number.");
        return;
      }

      // Get the warranties collection from the found customer
      const warrantiesRef = customerDoc.ref.collection("Warranties");
      const warrantiesSnapshot = await warrantiesRef.get();

      if (warrantiesSnapshot.empty) {
        res.status(404).send("No warranty records found for this customer.");
        return;
      }

      // Format each warranty document data
      const warrantyDetails = warrantiesSnapshot.docs.map((doc) => ({
        id: doc.id,
        startdate: formatTimestamp(doc.data().startdate), // Format startdate
        endingdate: formatTimestamp(doc.data().endingdate), // Format endingdate
        devicedetails: doc.data().devicedetails,
      }));

      res.status(200).json({warrantyDetails});
    } catch (error) {
      console.error("Error fetching warranty details:", error);
      res.status(500).send("Error fetching warranty details");
    }
  });
});


/**
 * Helper function to format Firestore Timestamp to a readable date.
 * @param {Object} timestamp - Firestore Timestamp object.
 * @return {string} Formatted date string.
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp.seconds * 1000);
  // Firestore timestamps are in seconds
  return date.toLocaleDateString("en-US", {
    weekday: "long", // "Monday"
    year: "numeric", // "2025"
    month: "long", // "February"
    day: "numeric", // "10"
  });
}


// FUNCTION TO GENERATE PRODUCT WARRANTY THROUGH WHATSAPP


exports.registerWarranty = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    const {firstname, lastname, phoneNumber,
      devicedetails, deviceserial} = req.body;

    // Check if all required fields are provided
    if (!firstname || !lastname ||
      !phoneNumber || !devicedetails || !deviceserial) {
      res.status(400).send("All fields are required");
      return;
    }

    const last10Digits = phoneNumber.slice(-10);
    // Extract last 10 digits of phone number

    // Function to format date as 'DD-MM-YYYY' with time zone adjustment
    const formatDate = (date) => {
      const d = new Date(date);
      const adjustedDate = new Date(d.getTime() + d
          .getTimezoneOffset() * 60000);
      const day = ("0" + adjustedDate.getDate()).slice(-2); // Ensure 2 digits
      const month = ("0" + (adjustedDate.getMonth() + 1)).slice(-2);
      // Ensure 2 digits, months are 0-indexed
      const year = adjustedDate.getFullYear();
      return `${day}-${month}-${year}`;
    };

    try {
      const customersRef = admin.firestore().collection("Customers");
      const customersSnapshot = await customersRef.get();

      if (customersSnapshot.empty) {
        res.status(404).send("Customer not found.");
        return;
      }

      let customerFound = false;
      let customerDoc = null;

      // Iterate through all customers
      customersSnapshot.forEach((doc) => {
        const customerPhone = doc.data().phone;

        if (customerPhone && customerPhone.slice(-10) === last10Digits) {
          customerFound = true;
          customerDoc = doc;
        }
      });

      if (customerFound && customerDoc) {
        // Customer found, proceed to register the warranty
        const warrantiesRef = customerDoc.ref.collection("Warranties");

        // Create Warranty ID: CurrentYearSAB-000<Random 4-digit number>
        const currentYear = new Date().getFullYear();
        const randomFourDigits = Math.floor(1000 + Math.random() * 9000);
        // Generate 4-digit random number
        const warrantyID = `${currentYear}SAB-000${randomFourDigits}`;

        // Get current date and ending date (1 year after current date)
        const startDateObject = new Date();
        const endingDateObject = new Date(startDateObject);
        endingDateObject.setFullYear(endingDateObject.getFullYear() + 1);

        // Format both startdate and endingdate as 'DD-MM-YYYY'
        const formattedStartDate = formatDate(startDateObject);
        const formattedEndingDate = formatDate(endingDateObject);

        // Add new warranty to the sub-collection
        await warrantiesRef.doc(warrantyID).set({
          firstname: firstname,
          lastname: lastname,
          phone: last10Digits, // Store last 10 digits of phone
          devicedetails: devicedetails,
          deviceserial: deviceserial,
          startdate: formattedStartDate, // Start date formatted as 'DD-MM-YYYY'
          endingdate: formattedEndingDate,
          // 1-year warranty ending date formatted as 'DD-MM-YYYY'
        });

        // Send response with the warranty ID
        res.status(200).send(`Warranty registered successfully: ${warrantyID}`);
      } else {
        // Customer not found
        res.status(404).send({
          message: "Customer not found.",
          additionalDetailsNeeded: true, // Option to ask for additional info
        });
      }
    } catch (error) {
      console.error("Error registering warranty:", error);
      res.status(500).send("Internal Server Error");
    }
  });
});


// GET CUSTOMER COMPLAINT BY PHONE NUMBER THROUGH WHATSAPP


exports.getCustomerComplaintsW = functions.https
    .onRequest(async (req, res) => {
      cors(req, res, async () => {
        try {
          // Get phone number and complaint document ID from the request body
          const phoneNumber = req.body.phoneNumber;
          const complaintDocId = req.body.complaintDocId;

          // Validate input
          if (!phoneNumber || phoneNumber.length < 10) {
            return res.status(400).send("Invalid phone number");
          }

          if (!complaintDocId) {
            return res.status(400).send("Complaint document ID is required");
          }

          // Extract the last 10 digits of the phone number
          const last10Digits = phoneNumber.slice(-10);

          // Query the 'Customers' collection to find the document
          const customersSnapshot = await admin.firestore()
              .collection("Customers").get();

          if (customersSnapshot.empty) {
            return res.status(404).send("No customer found");
          }

          let customerFound = false;
          let customerDoc = null;

          // Iterate through all customers
          customersSnapshot.forEach((doc) => {
            const customerPhone = doc.data().phone;

            if (customerPhone && customerPhone.slice(-10) === last10Digits) {
              customerFound = true;
              customerDoc = doc;
            }
          });

          if (!customerFound || !customerDoc) {
            return res.status(404).send("No customer found");
          }

          // Reference to the 'Complaints' sub-collection of the customer
          const complaintDocRef = customerDoc.ref
              .collection("Complaints").doc(complaintDocId);

          // Fetch the document by its ID from the 'Complaints' sub-collection
          const complaintDoc = await complaintDocRef.get();

          if (!complaintDoc.exists) {
            return res.status(404).send("Complaint document not found");
          }

          // Extract 'complaint' and 'complaintstatus' fields
          const complaintData = complaintDoc.data();
          const {complaint, complaintstatus} = complaintData;

          // Format the response as an array to suit the Twilio syntax
          const complaintsDetails = [{
            complaint: complaint,
            complaintstatus: complaintstatus,
          }];

          // Return the structured response
          return res.status(200).json({
            complaintsDetails: complaintsDetails,
          });
        } catch (error) {
          console.error("Error fetching complaint details:", error);
          return res.status(500).send("Error fetching complaint details");
        }
      });
    });

// Function to check if a document exists based on
//  the 'phone' field in 'Customers' collection

exports.checkCustomerExists = functions.https.onRequest(async (req, res) => {
  // Use the CORS middleware
  cors(req, res, async () => {
    try {
      // Get the phone number from the request body
      const phoneNumber = req.body.phoneNumber;

      // Validate the phone number
      if (!phoneNumber || phoneNumber.length < 10) {
        return res.status(400).send("Invalid phone number");
      }

      // Extract the last 10 digits of the phone number from the request body
      const last10Digits = phoneNumber.slice(-10);
      console.log("Searching for customer with phone number: ${last10Digits}");

      // Query all documents from the 'Customers' collection
      const customersSnapshot = await db.collection("Customers").get();

      // If no documents found, return 404
      if (customersSnapshot.empty) {
        console.log("No customers found in the database.");
        return res.status(404).send("Customer not found");
      }

      // Iterate through the documents to check
      // if any 'phone' field ends with the last 10 digits
      let customerFound = false;
      customersSnapshot.forEach((doc) => {
        const customerPhone = doc.data().phone;

        // Check if the last 10 digits of the 'phone' field
        // match the last 10 digits of the phone number
        if (customerPhone && customerPhone.slice(-10) === last10Digits) {
          customerFound = true;
        }
      });

      // Return the result based on whether a customer was found or not
      if (customerFound) {
        console.log("Customer exists with matching phone number.");
        return res.status(200).send("Customer exists");
      } else {
        console.log("No customer found with matching phone number.");
        return res.status(404).send("Customer not found");
      }
    } catch (error) {
      console.error("Error checking customer:", error);
      return res.status(500).send("Error checking customer");
    }
  });
});


// Function to add a new complaint
//  inside 'Complaints' sub-collection based on phone number

exports.addComplaint = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      // Extract data from the request body
      const {phone, firstname, lastname, address, city, complaint} = req.body;

      // Validate the phone number
      if (!phone || phone.length < 10) {
        return res.status(400).send("Invalid phone number");
      }

      // Validate other required fields
      if (!firstname || !lastname || !address || !city || !complaint) {
        return res.status(400).send("Missing required fields");
      }

      // Extract the last 10 digits of the phone number
      const last10Digits = phone.slice(-10);

      // Query the 'Customers' collection to find the customer
      // by the last 10 digits of their phone number
      const customersSnapshot = await admin.firestore()
          .collection("Customers").get();

      if (customersSnapshot.empty) {
        return res.status(404).send("Customer not found");
      }

      let customerFound = false;
      let customerDoc = null;

      // Iterate through all customers
      // to find the one with a matching phone number
      customersSnapshot.forEach((doc) => {
        const customerPhone = doc.data().phone;

        if (customerPhone && customerPhone.slice(-10) === last10Digits) {
          customerFound = true;
          customerDoc = doc;
        }
      });

      if (!customerFound || !customerDoc) {
        return res.status(404).send("Customer not found");
      }

      // Function to format date as 'DD-MM-YYYY' with time zone adjustment
      const formatDate = (date) => {
        const d = new Date(date);
        const adjustedDate = new Date(d.getTime() + d
            .getTimezoneOffset() * 60000);
        const day = ("0" + adjustedDate.getDate()).slice(-2); // Ensure 2 digits
        const month = ("0" + (adjustedDate.getMonth() + 1)).slice(-2);
        // Ensure 2 digits, months are 0-indexed
        const year = adjustedDate.getFullYear();
        return `${day}-${month}-${year}`;
      };

      // Generate a random 5-digit number for the complaint document ID
      const complaintDocId = Math
          .floor(10000 + Math.random() * 90000).toString();

      // Get the current date
      const currentDate = new Date()
          .toISOString().split("T")[0]; // Format: YYYY-MM-DD

      const formattedDate = formatDate(currentDate);

      // Complaint data to be added
      const complaintData = {
        firstname: firstname,
        lastname: lastname,
        phone: "0" + last10Digits,
        address: address,
        city: city,
        complaint: complaint,
        complaintdate: formattedDate, // Set to current date
        closingdate: "", // Set empty for now
        complaintstatus: "Registered", // Initial status
      };

      // Add the complaint document to the 'Complaints'
      // sub-collection inside the customer document
      await customerDoc.ref.collection("Complaints")
          .doc(complaintDocId).set(complaintData);

      // Return a success response
      return res.status(200).send("Complaint registered successfully");
    } catch (error) {
      console.error("Error adding complaint:", error);
      return res.status(500).send("Error registering complaint");
    }
  });
});


// FETCH THE LATEST COMPLAINT


exports.getLatestComplaint = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const phone = req.body.phone;

    // Validate phone number
    if (!phone || phone.length < 10) {
      return res.status(400).send({error: "Phone number is required"});
    }

    try {
      // Slice the phone number to the last 10 digits
      const last10Digits = phone.slice(-10);

      // Query the 'Customers' collection to find the customer
      // by the last 10 digits of the phone number
      const customersSnapshot = await admin.firestore()
          .collection("Customers").get();

      if (customersSnapshot.empty) {
        return res.status(404).send({error: "Customer not found"});
      }

      let customerFound = false;
      let customerDoc = null;

      // Iterate through all customers
      // to find the one with a matching phone number
      customersSnapshot.forEach((doc) => {
        const customerPhone = doc.data().phone;

        if (customerPhone && customerPhone.slice(-10) === last10Digits) {
          customerFound = true;
          customerDoc = doc;
        }
      });

      if (!customerFound || !customerDoc) {
        return res.status(404).send({error: "Customer not found"});
      }

      // Fetch the latest document from the 'Complaints' sub-collection
      const complaintsSnapshot = await customerDoc.ref
          .collection("Complaints")
          .orderBy("complaintdate", "desc")
          .limit(1) // Get the latest complaint
          .get();

      // Check if there are any complaints
      if (complaintsSnapshot.empty) {
        return res.status(404).send({error: "No complaints found"});
      }

      // Get the latest complaint document and return its full document ID
      let complaintDocId;
      complaintsSnapshot.forEach((doc) => {
        complaintDocId = doc.id;
      });

      // Return the full complaint document ID
      return res.status(200).send({
        complaintDocId: complaintDocId,
      });
    } catch (error) {
      console.error("Error fetching latest complaint:", error);
      return res.status(500).send({error: "An error occurred"});
    }
  });
});


// Cloud Function for handling Twilio Webhook and sending automated responses
/* exports.twilioWebhook = functions.https.onRequest(async (req, res) => {
  const incomingPhone = req.body.From; // Phone number from Twilio
  const messageBody = req.body.Body.trim(); // Message content

  try {
    // Search for a customer with the incoming phone number
    const customerQuery = await db
        .collection("Customers")
        .where("phone", "==", incomingPhone)
        .get();

    // Respond with a welcome message and menu options
    const responseMessage = `
  Hello! Welcome to Sabro Customer Service. What may I help you with?

  Please reply with the highlighted word or option number:

  1 for Product Warranty
  2 for a Complaint
  3 for Registration
  4 for Update on your Order
  5 to talk to an Agent
`;


    if (customerQuery.empty) {
      // No matching customer found
      console.log(`No Customer found for phone number: ${incomingPhone}`);

      // Respond back to Twilio with the menu
      res.set("Content-Type", "text/xml");
      res.send(`
        <Response>
          <Message>${responseMessage}</Message>
        </Response>
      `);
    } else {
      // Matching customer found
      const customerDoc = customerQuery.docs[0];
      const customerId = customerDoc.id;

      // Save the incoming message to the customer's messages subcollection
      await db
          .collection("Customers")
          .doc(customerId)
          .collection("messages")
          .add({
            message: messageBody,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

      console.log(
          `Message from ${incomingPhone} linked to customer ID: ${customerId}`,
      );

      // Respond with the automated message and menu options
      res.set("Content-Type", "text/xml");
      res.send(`
        <Response>
          <Message>${responseMessage}</Message>
        </Response>
      `);
    }
  } catch (error) {
    console.error("Error handling Twilio webhook:", error);
    res.status(500).send("Internal Server Error");
  }
}); */


/* exports.getCustomerData = functions.https.onRequest(async (req, res) => {
  let {phone} = req.query;

  // Validate the input
  if (!phone) {
    res.status(400).send("Missing 'phone' parameter in the request.");
    return;
  }

  // Normalize the phone parameter: replace spaces with + if needed
  phone = phone.replace(/\s/g, "+");

  console.log("Normalized phone parameter:", phone);

  try {
    // Query Firestore with the normalized phone
    const customerQuery = await db
        .collection("Customers")
        .where("phone", "==", phone)
        .get();

    if (customerQuery.empty) {
      console.log(`No document found for phone: ${phone}`);
      res.status(404).send("No customer found with this phone number.");
      return;
    }

    const customerDoc = customerQuery.docs[0];
    console.log("Customer found:", customerDoc.data());

    res.status(200).json({
      id: customerDoc.id,
      ...customerDoc.data(),
    });
  } catch (error) {
    console.error("Error retrieving customer data:", error);
    res.status(500).send("Internal Server Error.");
  }
}); */


/* exports.submitComplaint = functions.https.onRequest(async (req, res) => {
  const {customerId, subject, description} = req.body;

  try {
    // Check if the customer exists
    const customerDoc = await db.collection("Customers").doc(customerId).get();
    if (!customerDoc.exists) {
      res.status(404).send("Customer not found.");
      return;
    }

    // Add a new complaint
    await db.collection("complaints").add({
      customerId,
      subject,
      description,
      status: "open", // Status defaults to "open"
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send("Complaint submitted successfully!");
  } catch (error) {
    console.error("Error submitting complaint:", error);
    res.status(500).send("Failed to submit complaint.");
  }
}); */
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING


// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// CLOUD FUNCTIONS FOR WIX
// Existing Cloud Function for adding a new customer to Firestore
exports.addCustomer = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const {firstname, lastname, email, phone, address, city} = req.body;

    // Validate required fields
    if (!firstname || !lastname || !email || !phone || !address || !city) {
      res.status(400).send("Missing required fields");
      return;
    }

    // Function to format date as 'DD-MM-YYYY' with time zone adjustment
    const formatDate = (date) => {
      const d = new Date(date);
      const adjustedDate = new Date(d.getTime() + d
          .getTimezoneOffset() * 60000);
      const day = ("0" + adjustedDate.getDate()).slice(-2); // Ensure 2 digits
      const month = ("0" + (adjustedDate.getMonth() + 1)).slice(-2);
      // Ensure 2 digits, months are 0-indexed
      const year = adjustedDate.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // Check if the phone or email already exists in Firestore
    const customersRef = db.collection("Customers");
    const emailQuery = customersRef.where("email", "==", email);
    const phoneQuery = customersRef.where("phone", "==", phone);

    Promise.all([emailQuery.get(), phoneQuery.get()])
        .then(([emailSnapshot, phoneSnapshot]) => {
          if (!emailSnapshot.empty) {
            res.status(400)
                .json({message: "A customer with this email already exists."});
            return;
          }

          if (!phoneSnapshot.empty) {
            res.status(400)
                .json({message: "A customer with this phone already exists. "});
            return;
          }

          // Get the current timestamp and format it
          const currentDate = new Date();
          const formattedCreatedAt = formatDate(currentDate);

          // Add customer to Firestore if no conflicts
          return customersRef.add({
            firstname,
            lastname,
            email,
            phone,
            address,
            city,
            createdAt: formattedCreatedAt, // Formatted 'createdAt' field
          });
        })
        .then(() => {
          res.status(200)
              .json({message: "Customer added successfully!"});
        })
        .catch((error) => {
          res.status(500)
              .json({message: "Error Adding Customer: " + error.message});
        });
  });
});


// GET CUSTOMER DATA FROM FIRESTORE TO WIX
exports.getCustomersData = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const snapshot = await admin.firestore()
          .collection("Customers").orderBy("createdAt").get();

      const customers = snapshot.docs.map((doc) => {
        return {
          id: doc.id,
          firstname: doc.data().firstname,
          lastname: doc.data().lastname,
          phone: doc.data().phone,
          email: doc.data().email,
          address: doc.data().address,
          city: doc.data().city,
          createdAt: doc.data().createdAt,
        };
      });

      res.status(200).send(customers);
    } catch (error) {
      console.error("Error retrieving customer data:", error);
      res.status(500).send({error: "Unable to retrieve customer data"});
    }
  });
});


// STORE THE UPDATED CUSTOMER DATA FROM WIX TO FIRESTORE
exports.saveUpdatedCustomer = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405)
          .json({message: "Only POST requests are allowed"});
    }

    const customerData = req.body;

    if (!customerData.id) {
      return res.status(400).json({message: "Customer ID is required"});
    }

    try {
      // Reference to the customer document in Firestore
      const customerRef = db.collection("Customers").doc(customerData.id);

      // Check if customer exists
      const customerDoc = await customerRef.get();
      if (!customerDoc.exists) {
        return res.status(404).json({message: "Customer not found"});
      }

      // Update customer data in Firestore
      await customerRef.update({
        firstname: customerData.firstname,
        lastname: customerData.lastname,
        phone: customerData.phone,
        email: customerData.email,
        address: customerData.address,
        city: customerData.city,
      });

      // Return a success response
      return res.status(200)
          .json({message: "Customer data updated successfully"});
    } catch (error) {
      console.error("Error updating customer data:", customerData.id, error);
      return res.status(500)
          .json({message: "Internal server error", error: error.message});
    }
  });
});


// GET ALL CUSTOMER WARRANTY DATA FROM FIRESTORE TO WIX
exports.getAllCustomerWarranties = functions
    .https.onRequest(async (req, res) => {
      cors(req, res, async () => {
        try {
          const customersSnapshot = await admin.firestore()
              .collection("Customers").get();

          const customersWithWarranties = [];

          // Loop through each customer document
          for (const customerDoc of customersSnapshot.docs) {
            const customerData = customerDoc.data();

            // Fetch warranties for each customer
            const warrantiesSnapshot = await admin.firestore()
                .collection("Customers")
                .doc(customerDoc.id)
                .collection("Warranties")
                .get();

            const warranties = warrantiesSnapshot.docs.map((warrantyDoc) => {
              const warrantyData = warrantyDoc.data();

              // Convert Firestore timestamps to JavaScript Date objects
              const startdate = warrantyData
                  .startdate; // Convert Firestore timestamp to Date

              return {
                id: warrantyDoc.id,
                ...warrantyData,
                startdate: startdate,
                // Format Date as readable string (e.g., "MM/DD/YYYY")
              };
            });

            // Add customer data along with warranties
            customersWithWarranties.push({
              id: customerDoc.id,
              ...customerData,
              warranties: warranties,
            });
          }

          // Send response with all customers and their warranties
          res.status(200).send(customersWithWarranties);
        } catch (error) {
          console.error("Error retrieving customer warranties:", error);
          res.status(500)
              .send({error: "Unable to retrieve customer warranties"});
        }
      });
    });


// STORE THE WARRANTY RECORDS FROM WIX FORM TO FIRESTORE
exports.handleWarrantyFormSubmit = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Check if request is POST
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      // Parse incoming data
      const {firstname, lastname, phone, email,
        startdate, devicedetails, deviceserial} = req.body;

      // Check if all required fields are provided
      if (!firstname || !lastname || !phone ||
        !email || !startdate || !devicedetails || !deviceserial) {
        return res.status(400).send("Missing required fields");
      }

      // Function to format date as 'DD-MM-YYYY' with time zone adjustment
      const formatDate = (date) => {
        const d = new Date(date);
        const adjustedDate = new Date(d.getTime() + d
            .getTimezoneOffset() * 60000);
        // Adjust for timezone offset
        const day = ("0" + adjustedDate.getDate()).slice(-2);
        // Ensure 2 digits
        const month = ("0" + (adjustedDate
            .getMonth() + 1)).slice(-2);
        // Ensure 2 digits, months are 0-indexed
        const year = adjustedDate.getFullYear();
        return `${day}-${month}-${year}`;
      };

      // Check if the 'Customers' collection
      // contains a document with the provided email
      const customerDocRef = admin.firestore()
          .collection("Customers").where("email", "==", email);
      const customerSnapshot = await customerDocRef.get();

      if (!customerSnapshot.empty) {
        // Document with email exists, work with the first match
        const customerDoc = customerSnapshot.docs[0];
        const customerId = customerDoc.id; // Get customer document ID

        // Generate a dynamic Warranty document ID
        const currentYear = new Date().getFullYear();
        const warrantyId = `${currentYear}SAB-000${generateUniqueId()}`;

        // Create a copy of the startdate object
        // to calculate the ending date (1 year after start date)
        const startDateObject = new Date(startdate);
        const endingDateObject = new Date(startDateObject);
        // Create a copy of the startDateObject
        endingDateObject.setFullYear(endingDateObject.getFullYear() + 1);

        // Format both startdate and endingdate
        // as 'DD-MM-YYYY' with time zone adjustment
        const formattedStartDate = formatDate(startDateObject);
        const formattedEndingDate = formatDate(endingDateObject);

        // Create a new 'Warranties' subcollection
        // under the 'Customers' document
        const warrantyDocRef = admin.firestore()
            .collection("Customers")
            .doc(customerId)
            .collection("Warranties")
            .doc(warrantyId);

        // Add warranty data to Firestore
        await warrantyDocRef.set({
          firstname,
          lastname,
          phone,
          email,
          startdate: formattedStartDate,
          endingdate: formattedEndingDate,
          devicedetails,
          deviceserial,
        });

        return res.status(200).send({status: "success",
          message: "Warranty document created"});
      } else {
        return res.status(404).send({status: "error",
          message: "Customer not found"});
      }
    } catch (error) {
      console.error("Error processing the form:", error);
      return res.status(500).send({status: "error",
        message: "Internal Server Error"});
    }
  });
});


// Helper function to generate unique number for the warranty ID
/**
 * Generates a unique 4-digit number.
 * @return {number} A unique 4-digit number.
 */
function generateUniqueId() {
  return Math.floor(1000 + Math.random() * 9000); // Generate a number
}


// STORE THE COMPLAINT RECORDS FROM WIX FORM TO FIRESTORE
/**
 * Generates a unique 4-digit complaint ID for a customer.
 * Ensures the generated ID doesn't already exist.
 *
 * @param {string} customerId - The ID of the customer document.
 * @return {Promise<string>} - A promise that resolves to unique complaint ID.
 */
async function generateUniqueComplaintId(customerId) {
  let uniqueId;
  let exists = true;

  while (exists) {
    // Generate a random 4-digit number
    uniqueId = Math.floor(1000 + Math.random() * 9000).toString();

    // Check if the generated ID already exist in the 'Complaints' subcollection
    const existingComplaintDoc = await admin.firestore()
        .collection("Customers")
        .doc(customerId)
        .collection("Complaints")
        .doc(uniqueId)
        .get();

    if (!existingComplaintDoc.exists) {
      exists = false; // ID is unique
    }
  }

  return uniqueId;
}

/**
 * Cloud function to handle complaint form submission.
 * Stores complaint information in Firestore under a 'Complaints' subcollection
 * for the customer identified by their email.
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @returns {Promise<void>} - Sends a success or error response.
 */
exports.handleComplaintFormSubmit = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Check if request is POST
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      // Parse incoming data
      const {
        firstname,
        lastname,
        phone,
        email,
        city,
        address,
        complaint,
      } = req.body;

      // Check if all required fields are provided
      if (!firstname || !lastname || !phone || !email ||
         !city || !address || !complaint) {
        return res.status(400).send("Missing required fields");
      }

      // Function to format date as 'DD-MM-YYYY' with time zone adjustment
      const formatDate = (date) => {
        const d = new Date(date);
        const adjustedDate = new Date(d.getTime() + d
            .getTimezoneOffset() * 60000);
        // Adjust for timezone offset
        const day = ("0" + adjustedDate.getDate()).slice(-2);
        // Ensure 2 digits
        const month = ("0" + (adjustedDate
            .getMonth() + 1)).slice(-2);
        // Ensure 2 digits, months are 0-indexed
        const year = adjustedDate.getFullYear();
        return `${day}-${month}-${year}`;
      };

      // Check if the 'Customers' collection
      // contains a document with the provided email
      const customerDocRef = admin.firestore()
          .collection("Customers")
          .where("email", "==", email);
      const customerSnapshot = await customerDocRef.get();

      if (!customerSnapshot.empty) {
        // Document with email exists, work with the first match
        const customerDoc = customerSnapshot.docs[0];
        const customerId = customerDoc.id; // Get customer document ID

        // Generate a unique 4-digit complaint ID
        const complaintId = await generateUniqueComplaintId(customerId);

        // Get current date for complaint date
        const complaintDate = new Date();
        const formattedComplaintDate = formatDate(complaintDate);

        // Set default values for complaint status and closing date
        const complaintStatus = "Registered";
        const closingDate = ""; // Leave empty

        // Create a new 'Complaints' subcollection
        // under the 'Customers' document with the unique ID
        const complaintDocRef = admin.firestore()
            .collection("Customers")
            .doc(customerId)
            .collection("Complaints")
            .doc(complaintId);

        // Add complaint data to Firestore
        await complaintDocRef.set({
          firstname,
          lastname,
          phone,
          email,
          city,
          address,
          complaint,
          complaintdate: formattedComplaintDate,
          complaintstatus: complaintStatus,
          closingdate: closingDate,
        });

        return res.status(200).send({status: "success",
          message: "Complaint document created", complaintId});
      } else {
        return res.status(404).send({status: "error",
          message: "Customer not found"});
      }
    } catch (error) {
      console.error("Error processing the form:", error);
      return res.status(500).send({status: "error",
        message: "Internal Server Error"});
    }
  });
});


// GET ALL CUSTOMER COMPLAINT DATA FROM FIRESTORE TO WIX
exports.getAllCustomerComplaints = functions.https
    .onRequest(async (req, res) => {
      cors(req, res, async () => {
        try {
          const customersSnapshot = await admin.firestore()
              .collection("Customers").get();

          const customersWithComplaints = [];

          // Loop through each customer document
          for (const customerDoc of customersSnapshot.docs) {
            const customerData = customerDoc.data();

            // Fetch complaints for each customer
            const complaintsSnapshot = await admin.firestore()
                .collection("Customers")
                .doc(customerDoc.id)
                .collection("Complaints")
                .get();

            const complaints = complaintsSnapshot.docs.map((complaintDoc) => {
              const complaintData = complaintDoc.data();

              // Convert Firestore timestamp to JavaScript Date
              // for 'complaintdate' if it exists
              // const complaintDate = complaintData.complaintdate; &&
              // complaintData.complaintdate._seconds ?
              // new Date(complaintData.complaintdate._seconds * 1000):
              // null;

              // 'closingdate' is likely already a string or null,
              // so handle it directly
              // const closingDate = complaintData.closingdate || null;

              return {
                id: complaintDoc.id, // Include complaint document ID
                ...complaintData,
                // complaintdate: complaintdate,
                // closingdate: closingDate, // Keep closing date as-is
              };
            });

            // Add customer data along with complaints
            customersWithComplaints.push({
              id: customerDoc.id, // Include customer document ID
              ...customerData,
              complaints: complaints, // Include all complaints
            });
          }

          // Send response with all customers and their complaints
          res.status(200).send(customersWithComplaints);
        } catch (error) {
          console.error("Error retrieving customer complaints:", error);
          res.status(500).send({error: "Unable to retrieve"});
        }
      });
    });


// STORE THE UPDATED COMPLAINT DATA FROM WIX TO FIRESTORE
exports.updateComplaintStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Only allow POST requests
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      // Extract data from the request body
      const {customerId, complaintId, complaint,
        complaintstatus, closingdate} = req.body;

      if (!customerId || !complaintId || !complaint ||
         !complaintstatus || !closingdate) {
        return res.status(400).send("Invalid request: Missing required fields");
      }

      // Reference to the specific complaint document
      const complaintDocRef = admin.firestore()
          .collection("Customers")
          .doc(customerId)
          .collection("Complaints")
          .doc(complaintId);

      // Update the complaint document
      await complaintDocRef.update({
        complaint,
        complaintstatus,
        closingdate,
      });

      console.log(`Complaint ${complaintId} for customer
         ${customerId} updated successfully`);
      return res.status(200).send({success: true, message:
         "Complaint updated successfully"});
    } catch (error) {
      console.error("Error updating complaint:", error);
      return res.status(500).send({success: false,
        message: "Failed to update complaint"});
    }
  });
});

// SEARCH FOR A WARRANTY RECORD BASED ON PHONE NUMBER
// functions/index.js


exports.getWarrantiesByPhone = functions.https.onRequest((req, res) => {
  // Handle CORS preflight requests and actual requests
  cors(req, res, async () => {
    // Ensure the correct method is used
    if (req.method === "OPTIONS") {
      return res.status(204).send(""); // Respond to preflight request
    }

    // Retrieve the phone number from the query string
    const phoneQuery = req.query.phone;

    if (!phoneQuery || phoneQuery.length !== 10) {
      return res.status(400).json({
        status: "error",
        message: "Invalid phone number.",
      });
    }

    // Function to find warranties based on phone number
    const getWarranties = async (phone) => {
      try {
        const customersSnapshot = await db.collection("Customers").get();
        let warranties = [];

        customersSnapshot.forEach((customerDoc) => {
          const customerData = customerDoc.data();
          const customerPhone = customerData.phone || "";

          // Compare the last 10 digits of the
          //  stored phone number with the query phone number
          if (customerPhone.slice(-10) === phone) {
            // Fetch the 'Warranties' subcollection
            const warrantiesRef = db.collection("Customers")
                .doc(customerDoc.id).collection("Warranties");
            warranties.push(warrantiesRef.get());
          }
        });

        // Wait for all promises to resolve
        warranties = await Promise.all(warranties);

        // Flatten warranties array and extract relevant data
        const warrantyData = [];
        warranties.forEach((warrantySnapshot) => {
          warrantySnapshot.forEach((doc) => {
            warrantyData.push({
              id: doc.id,
              devicedetails: doc.data().devicedetails,
              startdate: doc.data().startdate,
              endingdate: doc.data().endingdate,
            });
          });
        });

        if (warrantyData.length > 0) {
          return res.status(200).json({
            status: "success",
            warranties: warrantyData,
          });
        } else {
          return res.status(404).json({
            status: "error",
            message: "No warranties found for this phone number",
          });
        }
      } catch (error) {
        console.error("Error fetching warranties:", error);
        return res.status(500).json({
          status: "error",
          message: "Internal server error",
        });
      }
    };

    // Call the function with the last 10 digits of the phone number
    await getWarranties(phoneQuery);
  });
});


exports.getComplaintsByPhone = functions.https.onRequest((req, res) => {
  // Handle CORS preflight requests and actual requests
  cors(req, res, async () => {
    // Ensure the correct method is used
    if (req.method === "OPTIONS") {
      return res.status(204).send(""); // Respond to preflight request
    }

    // Retrieve the phone number from the query string
    const phoneQuery = req.query.phone;

    if (!phoneQuery || phoneQuery.length !== 10) {
      return res.status(400).json({
        status: "error",
        message: "Invalid phone number. Please provide the last 10 digits.",
      });
    }

    // Function to find complaints based on phone number
    const getComplaints = async (phone) => {
      try {
        const customersSnapshot = await db.collection("Customers").get();
        let complaints = [];

        customersSnapshot.forEach((customerDoc) => {
          const customerData = customerDoc.data();
          const customerPhone = customerData.phone || "";

          // Compare the last 10 digits of the stored phone number
          // with the query phone number
          if (customerPhone.slice(-10) === phone) {
            // Fetch the 'Complaints' subcollection
            const complaintsRef = db.collection("Customers")
                .doc(customerDoc.id).collection("Complaints");
            complaints.push(complaintsRef.get());
          }
        });

        // Wait for all promises to resolve
        complaints = await Promise.all(complaints);

        // Flatten complaints array and extract relevant data
        const complaintData = [];
        complaints.forEach((complaintSnapshot) => {
          complaintSnapshot.forEach((doc) => {
            complaintData.push({
              id: doc.id,
              complaint: doc.data().complaint,
              complaintstatus: doc.data().complaintstatus,
            });
          });
        });

        if (complaintData.length > 0) {
          return res.status(200).json({
            status: "success",
            complaints: complaintData,
          });
        } else {
          return res.status(404).json({
            status: "error",
            message: "No complaints found for this phone number",
          });
        }
      } catch (error) {
        console.error("Error fetching complaints:", error);
        return res.status(500).json({
          status: "error",
          message: "Internal server error",
        });
      }
    };

    // Call the function with the last 10 digits of the phone number
    await getComplaints(phoneQuery);
  });
});
