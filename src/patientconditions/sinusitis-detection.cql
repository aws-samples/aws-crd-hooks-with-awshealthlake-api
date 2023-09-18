library LibraryOne version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "SNOMEDCT": 'http://snomed.info/sct'

code "Chronic sinusitis (disorder)": '40055000' from "SNOMEDCT" display 'Chronic sinusitis (disorder)'

context Patient


define hassinusitis:
  exists(
    [Condition: "Chronic sinusitis (disorder)"]
  )
