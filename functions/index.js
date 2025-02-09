const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();


// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// CLOUD FUNCTION FOR TWILIO
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


exports.getCustomerData = functions.https.onRequest(async (req, res) => {
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
});


exports.submitComplaint = functions.https.onRequest(async (req, res) => {
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
});
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING


// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// COMMENT ADDED FOR EXTRA SPACE BECAUSE ESLINT IS ANNOYING
// CLOUD FUNCTIONS FOR WIX
// Existing Cloud Function for adding a new customer to Firestore
exports.addCustomer = functions.https.onRequest(async (req, res) => {
  const {firstname, lastname, email, phone, address, city} = req.body;

  // Validate required fields
  if (!firstname || !lastname || !email || !phone || !address || !city) {
    res.status(400).send("Missing required fields");
    return;
  }

  try {
    // Auto-generate a serialNo using Firestore's auto-ID
    const customerRef = await db.collection("Customers").add({
      firstname,
      lastname,
      email,
      phone,
      address,
      city,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("Customer added with ID:", customerRef.id);

    res.status(200).send({
      message: "Customer added successfully!",
      serialNo: customerRef.id, // Return the generated serialNo (document ID)
    });
  } catch (error) {
    console.error("Error adding customer:", error);
    res.status(500).send("Error adding customer: " + error.message);
  }
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
          createdAt: doc.data().createdAt.toDate(),
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
exports.updateCustomerData = functions.https.onRequest(async (req, res) => {
  try {
    const customerData = req.body;
    const customerId = customerData.id;

    // Update the Firestore document with the new data
    await admin.firestore().collection("Customers").doc(customerId).update({
      firstname: customerData.firstname,
      lastname: customerData.lastname,
      phone: customerData.phone,
      email: customerData.email,
      address: customerData.address,
      city: customerData.city,
      createdAt: admin.firestore.Timestamp
          .fromDate(new Date(customerData.createdAt)), // Keep original date
    });

    res.status(200).send({success: true});
  } catch (error) {
    console.error("Error updating customer data:", error);
    res.status(500).send({error: "Unable to update customer data"});
  }
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
        startdate, devicedetails} = req.body;

      // Check if all required fields are provided
      if (!firstname || !lastname || !phone ||
         !email || !startdate || !devicedetails) {
        return res.status(400).send("Missing required fields");
      }

      // Check if the 'Customers' collection
      //  contains a document with the provided email
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

        // Calculate the ending date (1 year after start date)
        const startDateObject = new Date(startdate);
        const endingDate = new Date(startDateObject
            .setFullYear(startDateObject.getFullYear() + 1));

        // Create a new 'Warranties' subcollection underthe 'Customers' document
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
          startdate,
          endingdate: endingDate,
          devicedetails,
        });

        return res.status(200)
            .send({status: "success", message: "Warranty document created"});
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


// GET ALL CUSTOMER COMPLAINT DATA FROM FIRESTORE TO WIX
exports.getAllCustomerComplaints = functions
    .https.onRequest(async (req, res) => {
      cors(req, res, async () => {
        try {
          const customersSnapshot = await admin
              .firestore().collection("Customers").get();

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

              // Convert Firestore timestamps to JavaScript Date objects
              const complaintDate = complaintData.complaintdate.toDate();
              // still a Firestore timestamp
              let closingDate = null;

              // Since 'closingdate' is a string,
              // no need to convert it using .toDate()
              if (complaintData.closingdate) {
                closingDate = complaintData.closingdate;
                // directly use the string value
              }

              return {
                id: complaintDoc.id,
                ...complaintData,
                complaintdate: complaintDate.toLocaleDateString(),
                // Format 'complaintdate'
                closingdate: closingDate || null,
                // No need to format the string 'closingdate'
              };
            });

            // Add customer data along with complaints
            customersWithComplaints.push({
              id: customerDoc.id,
              ...customerData,
              complaints: complaints,
            });
          }

          // Send response with all customers and their complaints
          res.status(200).send(customersWithComplaints);
        } catch (error) {
          console.error("Error retrieving customer complaints:", error);
          res.status(500)
              .send({error: "Unable to retrieve customer complaints"});
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
  // Ensure CORS is handled
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST");
  res.set("Access-Control-Allow-Headers', 'Content-Type");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
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

        // Compare the last 10 digits of the stored phone number
        //  with the query phone number
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
  getWarranties(phoneQuery);
});
