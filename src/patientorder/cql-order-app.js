const { path } = require('path');
const cql = require('cql-execution');
const cqlfhir = require('cql-exec-fhir');
const cqlvsac = require('cql-exec-vsac');
const { HttpRequest } = require("@aws-sdk/protocol-http");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");
const { SignatureV4 } = require("@aws-sdk/signature-v4");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");
const { Sha256 } = require("@aws-crypto/sha256-browser");


const AWS = require('aws-sdk');

const HL_DATASTORE_ID =  '/datastore/' + process.env.DATASTOREID
var region = process.env.AWS_REGION // e.g. us-west-1
var domain = 'healthlake.'+region+'.amazonaws.com'; // e.g. search-domain.region.es.amazonaws.com
const fs = require('fs');
 // Sign the request
var signer = new SignatureV4({
        credentials: defaultProvider(),
        region: region,
        service: 'healthlake',
        sha256: Sha256
});
var headers_JSON = {
            'Content-Type': 'application/json',
            'host': domain
        };
var method_get = 'GET' ;     


async function getPatientResource(patientId) {
    console.log('Entering new getPatientResource');

     // Create the HTTP request
    var request = new HttpRequest({

        headers: headers_JSON,
        hostname: domain,
        method: method_get ,
        path: HL_DATASTORE_ID + '/r4/Patient',
        query: { "_id": patientId }
    });
    var signedRequest = await signer.sign(request);

    // Send the request
    var client = new NodeHttpHandler();
    var { response } = await client.handle(signedRequest);
    console.log(response.statusCode + ' ' + response.body.statusMessage);
    var responseBody = '';
    await new Promise((resolve) => {
        response.body.on('data', (chunk) => {
            responseBody += chunk;
        });
        response.body.on('end', () => {
         //   console.log('Response body: ' + responseBody);
            resolve(responseBody);
        });
    }).catch((err) => {
        console.log('Error: ' + err);
        return err;
    });
    return responseBody;
}

async function getClaimResources(patientId) {
    console.log('Entering new getClaimResources');
    
     // Create the HTTP request
    var request = new HttpRequest({

        headers: headers_JSON,
        hostname: domain,
        method: method_get ,
        path: HL_DATASTORE_ID + '/r4/Claim',
        query: { "patient": 'Patient/' + patientId }
    });
    var signedRequest = await signer.sign(request);

    // Send the request
    var client = new NodeHttpHandler();
    var { response } = await client.handle(signedRequest);
    console.log(response.statusCode + ' ' + response.body.statusMessage);
    var responseBody = '';
    await new Promise((resolve) => {
        response.body.on('data', (chunk) => {
            responseBody += chunk;
        });
        response.body.on('end', () => {
       //     console.log('Response body: ' + responseBody);
            resolve(responseBody);
        });
    }).catch((err) => {
        console.log('Error: ' + err);
        return err;
    });
    return responseBody;
}

exports.validatePriorAuth = async(event, context) => {
    console.log(event['body']);

    let fhirJSON = JSON.parse(event['body']);

    //created the same patient in HAPI FHIR
    let patientId = fhirJSON['prefetch']['patient']['identifier'][0]['value'];
    let medicationName  = fhirJSON['context']['draftOrders']['entry'][0]['resource']['medicationCodeableConcept']['text'];
    console.log('Bundle' + JSON.stringify(fhirJSON['context']['draftOrders']['entry'][0]['resource']['medicationCodeableConcept']['text']));

    console.log('Patient Id is ' + patientId);
    console.log('Medical name is ' + medicationName);

    const patientBundle = await getPatientResource(patientId);
    //console.log('FHIR Patient Resource received ' + patientBundle);
     //get Claim resources
    const claimResource = await getClaimResources(patientId);
   // console.log('FHIR claimResource Resource received ' + claimResource);

    const patientResource = JSON.parse(patientBundle)['entry'][0];
  //  console.log('Extracted patient resource ' + JSON.stringify(patientResource));

    var patientClaimBundle = JSON.parse(claimResource);
    patientClaimBundle['entry'].push(patientResource);
   

  //  console.log('Final bundle ' + JSON.stringify(patientClaimBundle));
    //const pat_data = (await s3.getObject(fhir_patient_params).promise()).Body.toString('utf-8');



    const patientSource = cqlfhir.PatientSource.FHIRv401();


    //var patientConditionJSON = JSON.stringify(patientConditionBundle);


    var fhirCqlJSON = '';
    var topicMetadata = '';
    try {
        fhirCqlJSON = fs.readFileSync('FHIRHelpers.json', 'utf8');
        //console.log(data);
    } catch (err) {
        console.error(err);
        return err;

    }
    console.log(fhirCqlJSON);

    const libraries = {
        FHIRHelpers: JSON.parse(String(fhirCqlJSON))

        
    };



    var conjCQLJSON = '';
    try {
        conjCQLJSON = fs.readFileSync('AmoxicillinPriorAuthRule-elm.json', 'utf8');
        //console.log(data);
    } catch (err) {
        console.error(err);
       return err;
    }
    console.log(conjCQLJSON);


    const elmFile = JSON.parse(String(conjCQLJSON));
    const library = new cql.Library(elmFile, new cql.Repository(libraries));

    //console.log(condition_data);

    const bundles = [patientClaimBundle];

    patientSource.loadBundles(bundles);

    const executor = new cql.Executor(library);
   // console.log('Patient source ' + patientSource);

    const results = executor.exec(patientSource);
   // console.log('Results count :' + results.patientResults);
    var isPriorAuthRequired = '';


    for (const id in results.patientResults) {
        const result = results.patientResults[id];
        console.log(`${id}: `);
        console.log(`\tis PriorAuth Prior Authorization Rule Outcome: ${JSON.stringify(result)}`);
        console.log(`\t Is Prior Autorization : ${result.PRIORAUTH_GRANTED}`);
        isPriorAuthRequired = result.PRIORAUTH_PENDED;
        //console.log(`\tNeedsFootExam: ${result.NeedsFootExam}`);
        //needs_foot_exam = result.NeedsFootExam;
    }
    
    if(isPriorAuthRequired && medicationName != null){

    var cards_json = {
        "cards": [{
                "summary": "Prior Authorization Required",
                "indicator": "severe",
                "detail": "Prior Authirization is required for :"+medicationName
                }
        ]
    };
    }
    //get fhir helper resources

    // throw new Error('Something went wrong');
    //return getCardResponse();
    return {

        statusCode: 200,
        headers: {
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Headers": "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers"

        },
        body: JSON.stringify(cards_json)
    };
};