import json
import boto3
from jsonpath_ng.ext import parse
import requests
from requests_auth_aws_sigv4 import AWSSigV4
import os

# import requests

client = boto3.client('comprehendmedical')
hl_datastore_id = os.environ.get('HL_DATASTORE_ID')


def get_cds_services(event, context):
    #Enable print or add logging framework if you neeed more logging
    #print(event)
    

    return {
        "statusCode": 200,
        "headers": {

            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers"

        },
        "body": json.dumps({
            "services": [
                {
                    "hook": "patient-view",
                    "name": "cql-executor",
                    "description": "Curated CQL execution results for demo. Returns results for Conjunctivitis detection.",
                    "id": "cql-executor",
                          "prefetch": {
                              "patient": "Patient/{{context.patientId}}",
                              "condition": "Condition?patient={{context.patientId}}"
                          }
                },
                 {
                    "hook": "order-select",
                    "name": "order-executor",
                    "description": "Curated CQL execution results for demo. Returns results for Conjunctivitis detection.",
                    "id": "order-executor",
                          "prefetch": {
                              "patient": "Patient/{{context.patientId}}",
                              "condition": "Claim?patient={{context.patientId}}"
                          }
                },
            ]
        }),
    }


  
