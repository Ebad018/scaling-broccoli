const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// Cloud Function for handling Twilio Webhook and checking customer details
exports.twilioWebhook = functions.https.onRequest(async (req, res) => {
  const incomingPhone = req.body.From; // Phone number from Twilio
  const messageBody = req.body.Body; // Message content

  try {
    // Search for a customer with the incoming phone number
    const customerQuery = await db
        .collection("Customers")
        .where("phone", "==", incomingPhone)
        .get();


    if (customerQuery.empty) {
      // No matching customer found
      console.log(`No Customer found for phone number: ${incomingPhone}`);

      // Respond back to Twilio
      res.set(
          "Content-Type",
          "text/xml",
      );

      res.send(`
  <Response>
    <Message>
      Message received and linked to your profile. Thank you!
    </Message>
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


      // Respond back to Twilio
      res.set("Content-Type", "text/xml");
      res.send(`
        <Response>
          <Message>Message received and linked to 
          your profile. Thank you!</Message>
        </Response>
      `);
    }
  } catch (error) {
    console.error("Error handling Twilio webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Existing Cloud Function for adding a new customer
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
exports.registerUser = functions.https.onRequest(async (req, res) => {
  const {name, email, phone, address} = req.body;

  try {
    // Generate a unique ID for the user
    const userId = phone;

    // Save the customer data
    await db.collection("Customers").doc(userId).set({
      name,
      email,
      phone,
      address,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send("User registered successfully!");
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).send("Failed to register user.");
  }
});
exports.updateComplaintStatus = functions.https.onRequest(async (req, res) => {
  const {complaintId, status} = req.body;

  try {
    // Update the complaint's status
    await db.collection("complaints").doc(complaintId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send(`Complaint status updated to ${status}.`);
  } catch (error) {
    console.error("Error updating complaint status:", error);
    res.status(500).send("Failed to update complaint status.");
  }
});
exports.getComplaints = functions.https.onRequest(async (req, res) => {
  const {customerId, status} = req.query;

  try {
    const complaintsQuery = db
        .collection("complaints")
        .where("customerId", "==", customerId);

    if (status) {
      complaintsQuery.where("status", "==", status);
    }

    const complaintsSnapshot = await complaintsQuery.get();
    const complaints = complaintsSnapshot.docs.map((doc) => doc.data());

    res.status(200).json(complaints);
  } catch (error) {
    console.error("Error retrieving complaints:", error);
    res.status(500).send("Failed to retrieve complaints.");
  }
});

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

exports.updateTabData = functions.https.onRequest(async (req, res) => {
  const collectionName = req.body.collection || "TabData"; // Collection name
  const tabId = req.body.tabId; // Tab ID to update
  const newContent = req.body.content; // New content to update

  try {
    await admin.firestore().collection(collectionName)
        .doc(tabId).update({content: newContent});
    res.status(200).send({message: "Tab updated successfully"});
  } catch (error) {
    res.status(500).send({message: "Error updating data", error});
  }
});

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

// Update customer data
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
                  .startdate.toDate(); // Convert Firestore timestamp to Date

              return {
                id: warrantyDoc.id,
                ...warrantyData,
                startdate: startdate
                    .toLocaleDateString(),
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

