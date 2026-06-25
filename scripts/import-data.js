import storageConnector from './src/connectors/storage.js';
import classificationEngine from './src/rules/classification.js';

// Your Excel data
const csvData = `Date,Employee(s) Attended Name(s),Project / Client Name,Meeting/Project Title,Start Time,End Time,Duration (hrs),Notes,Follow-Up
6/3/26,N/A,Personal,Slackbot,12:00 PM,4:00 PM,4,Created Slackbot to answer questions regarding OpenShift and Ansible; Integrates directly into slack channel and replies in a thread to prevent clutter; Upgraded to using an open-source model Z.ai GLM-3.7 Flash to now answer any question; ,
6/4/26,Harshil Bavaria,AT&T,IBM Concert Install,4:00 PM,5:00 PM,1,"Installed IBM Concert, Datapps, Workflows on OCP Cluster, using the OC CLI",
6/5/26,Matthew Budiman,Honda,Honda Bobathon,2:00 PM,4:00 PM,2,"Installed microservices such as Postgresql, Gitea onto OCP cluster, using YAML files. for Honda Bobathon",
6/8/26,Harshil Bavaria,Mentor Meeting,1-on-1,9:00 AM,9:30 AM,0.5,Write down all tasks you have done for now and condense after another meeting with Carl,
6/8/26,Senthilkumar Govindan,AT&T,AT&T Concert Standup,9:30 AM,10:00 AM,0.5,,
6/8/26,"Nameera Faisal Akhtar, Meenakshi Kodati, Rithik Taj K S, Tanay Gupta, Sonali Kanungo",Honda,Hona Observability PoC,10:00 AM,10:30 AM,0.5,"Pushed jobs/DAGS into Airflow; Getting DAGS via Airflow API into notebook; Pushing notebooks into watsonx.data problems for integration; When trying to create alerts only accepts DataStage jobs and not Pipeline Assets; When push System Metric the Default Condition is not what we need for each Metric (Failed Tasks doesn't need Seconds Metric); Watsonx may not have the workflows to send out the emails for the alerts; May have to wait for requirements to determine whether stand alone is sufficient or the watsonx integration is needed; UI and Dashboard not great when compared to Stand alone; Tested TOTAL_TASKS <= 5 but did not trigger, potentially still taking duration into account",Scheduled 1 on 1 with Nameera on 6/15/26 from 12:15 - 1:15
6/8/26,Harshil Bavaria & Matthew Budiman,AT&T,AT&T Concert Working Session,2:00 PM,3:00 PM,1,"Created Workflow that only pulls one application from AT&T, however informed there are multiple, thus trying to loop over all of the applications on the VM; Getting 8 parent/child pairs and using For Each Loop to get all Business Info; Taking all of the Apps and creating corresponding SBOMs; Now trying to go from SBOM to Application",
6/9/26,"Harshil Bavaria, Matthew Budiman, Senthilkumar Govindan",AT&T,AT&T Concert Standup,9:00 AM,9:30 AM,0.5,Created Workflow that goes from the Applications to VMs; Meet with Justin to figure out specific needs,
6/9/26,Matthew Budiman,Atos,IBM Cloud Pak Install,2:00 PM,4:00 PM,2,Installed IBM Cloud Pak onto OCP cluster and created step-by-step guide for client,
6/10/26,"Harshil Bavaria, Matthew Budiman, Senthilkumar Govindan",AT&T,AT&T Concert Standup,9:00 AM,9:30 AM,0.5,,
6/10/26,Client Engineering Team Members,IBM,Bob Office Hours - Client Engineering,10:00 AM,11:00 AM,1,"Introduced IBM Bob v2; Integrating Bob with IBM Premium Package with I; Created new modes: IBM I Database & IBM I Developer; Can run SQL commands, CL commands; Has workflows, which are basically a step-by-step guide that Bob has for various tasks such as Extracting Business Values, Optimizing SQL queries, etc.; Speaker: Tim Rowe; GA on June 24th; Reserve TechZone environment to mess around with it",Introduce myself to Tim Rowe and ask some follow ups regarding increased capabilities of I Premium Package
6/10/26,"Anish Subramanian, Brain Sahawneh, Luong Luong, Minahil Baig, Sam Khudairi, Tushar Bajaj, Zoubida Rezki",IBM,ATX ELH + Intern Roundtable,12:00 PM,1:00 PM,1,https://ibm-my.sharepoint.com/:w:/r/personal/akshay_mallireddy_ibm_com/Documents/Questions%20for%20Roundtable.docx?d=we0878096091b4d26a669dd4f1ef66cf6&csf=1&web=1&e=DAQLYa,
6/10/26,N/A,Personal,Learn Terraform,1:00 PM,5:00 PM,4,https://yourlearning.ibm.com/activity/PLAN-AFE5CE24B5C9,
6/11/26,"Senthilkumar Govindan, Harshil Bavaria, Matthew Budiman, Mandip Jangra, Sonali Kanungo, M N Navneeth",AT&T,AT&T Concert Standup,9:00 AM,9:30 AM,0.5,Trying to ingest different applications and see how CVs are being displayed; Only deploying applications on VMs; ,
6/11/26,"Meenakshi Kodati, Priya Naliah, Rithik Raj K S, Sonali Kanungo, Zoubida Rezki, Nameera Faisal Akhtar",Honda,Hona Observability PoC,10:00 AM,10:30 AM,0.5,Might have to create a ML model that looks at the metadata of the dataset; Received the RFP from Honda and meeting with client to answer questions; Alerts now work after talking with product team; Email integartion working; Jobs not able to be seen in watsonx Data Integration; Custom notebook used to pull DAGs and then push to the observability platform for alerts; Need to update the dashboard/UI for watsonx Data Integration; Seeing if can use Databand Stand Alone and then show roadmap on integration with Watsonx; ,
6/11/26,N/A,Honda,Learn more about Databand and read/analyze RFP,11:00 AM,1:00 PM,3,https://ibm-my.sharepoint.com/:w:/p/akshay_mallireddy/IQCitiG2dNvSQ5esXVlpaq4sAWu1xWKmEaU1l3qiKtga-14?e=QLhHBN,
6/11/26,Harshil Bavaria & Matthew Budiman,Atos,IBM Cloud Pak Install,1:00 PM,5:00 PM,4,"Trying to include the IBM Licensing Service in the Cloud Pak install and encountering NotFound OperandRegistry namespace, even when the namespace is there; Fixed it by creating a specific namespace to install of the required operators; Created the entire working guide for installing IBM Cloud Pak",
6/12/26,"Senthilkumar Govindan, Harshil Bavaria, Matthew Budiman, Mandip Jangra, Sonali Kanungo, M N Navneeth",AT&T,AT&T Concert Standup,9:00 AM,9:30 AM,0.5,Just preparing for demo and weekly call with AT&T; Able to fetch info from ServiceNow and create workflows and create SBOMs and ingest them,
6/12/26,N/A,Personal,Learn Terraform,10:00 AM,11:00 AM,1,"Launched simple nginx application with custom HTML page about UT using a ConfigMag; Learned about providers, basic terraform language (basically just yaml), and how to create the application, test, plan, and apply",
6/12/26,"Harshil Bavaria, Matthew Budiman, Jerry Bruce, Jamie Tasman, Tox Toczala, Joseph Crane, Drew Thompson, Dario Pulcinelli",Atos,Atos - Self Service Portal: Moving to Installation Phase,12:00 PM,12:30 PM,0.5,Had to reschedule because of meeting conflicts;,
6/12/26,N/A,Personal,watsonx.ai L3 Lab,2:00 PM,2:30 PM,0.5,https://ibm.seismic.com/apps/doccenter/861ea1fd-99e0-44d7-9135-85412e5c28d1/doc/%252Fdd3359e5f7-a856-a91b-7688-41024b2ac637%252FdfNTY4NmVhOWItY2RkNS04ZWY3LTZkNzItZTQwZjczMWUyMjk1%252CPT0%253D%252CRGF0YSBQbGF0Zm9ybQ%253D%253D%252FdfNDRmODBlMzMtY2ViMC0zMDI1LTVhNDEtNzg2OTg4MWVmZDBl%252COthers%252FdfOTRiYmU4NTQtNWY4NC03Y2QyLWZjYWUtOGIxYmFmZjkyZThk%252CPT0%253D%252CRWR1Y2F0aW9uL0xlYXJuaW5n%252Flf33838f6e-a1f3-44c9-9e55-57715d6fe1ee/grid/,
6/12/26,N/A,Personal ,watsonx.ai Tuning Studio LoRA tuning Lab,2:30 PM,5:00 PM,2.5,https://ibm.seismic.com/apps/doccenter/861ea1fd-99e0-44d7-9135-85412e5c28d1/doc/%252Fdd3359e5f7-a856-a91b-7688-41024b2ac637%252FdfNTY4NmVhOWItY2RkNS04ZWY3LTZkNzItZTQwZjczMWUyMjk1%252CPT0%253D%252CRGF0YSBQbGF0Zm9ybQ%253D%253D%252FdfNDRmODBlMzMtY2ViMC0zMDI1LTVhNDEtNzg2OTg4MWVmZDBl%252COthers%252FdfOTRiYmU4NTQtNWY4NC03Y2QyLWZjYWUtOGIxYmFmZjkyZThk%252CPT0%253D%252CRWR1Y2F0aW9uL0xlYXJuaW5n%252Flf29aff959-13a7-4de1-af9c-e401c787d516/grid/,Ran into roadblock with not having upgraded runtime instance; Also might have a problem with the IBM Cloud account that is associated with the reservation
6/15/26,"Harshil Bavaria, Matthew Budiman, Jerry Bruce, Jamie Tasman, Tox Toczala, Joseph Crane, Drew Thompson, Dario Pulcinelli",Atos,Atos - Self Service Portal: Moving to Installation Phase,9:00 AM,10:30 AM,1.5,Ran into errors with their cluster regarding the pvs and pvcs,
6/15/26,Nameera Faisal Akhtar,Personal,1 on 1,12:15 PM,1:15 PM,1,"watsonx DI doesn't have connection to Airflow yet, so using notebooks right now to get alerts",
6/16/26,N/A,Labs for Infrastructure Manager,IBM Infrastructure Manager Labs,9:00 AM,10:30 AM,1.5,Created a service for virtual machine provisioning; Created the step-by-step guide;,
6/16/26,Alexa Ramirez,Personal,1 on 1,11:00 AM,11:30 AM,0.5,"Create custom MCP server and full-stack application using Bob for auto time/task tracker; For QC, learn about gates and qisket, use the links she provided in Slack;",
6/16/26,N/A,Personal,Analyze Lab6 Bob Intro Labs ,11:30 AM,12:00 PM,0.5,Looking at Lab 6 and seeing what is applicable to my own application,`;

// Parse CSV
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    return fields;
  });
}

// Parse time
function parseTime(timeStr) {
  const str = String(timeStr).trim();
  let hours, minutes;
  
  if (str.includes('PM') || str.includes('AM')) {
    const isPM = str.includes('PM');
    const timePart = str.replace(/[AP]M/i, '').trim();
    const [h, m] = timePart.split(':').map(Number);
    
    hours = h;
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    minutes = m || 0;
  } else {
    const [h, m] = str.split(':').map(Number);
    hours = h;
    minutes = m || 0;
  }
  
  return { hours, minutes };
}

// Parse date
function parseDate(dateStr) {
  const [month, day, year] = dateStr.split('/');
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Main import function
async function importData() {
  console.log('Starting import...\n');
  
  // Initialize
  await storageConnector.initialize();
  await classificationEngine.initialize();
  
  // Parse CSV
  const rows = parseCSV(csvData);
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  console.log(`Found ${dataRows.length} entries to import\n`);
  
  let imported = 0;
  let skipped = 0;
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    
    try {
      const date = parseDate(row[0]);
      const attendees = row[1];
      const project = row[2];
      const title = row[3];
      const startTime = row[4];
      const endTime = row[5];
      const durationHrs = parseFloat(row[6]);
      const notes = row[7];
      
      const durationMinutes = Math.round(durationHrs * 60);
      
      // Parse start time
      const { hours, minutes } = parseTime(startTime);
      const fullStartTime = `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`;
      
      // Create entry
      const entry = {
        projectCode: project,
        taskType: 'imported',
        durationMinutes,
        date,
        startTime: fullStartTime,
        description: notes || title,
        meetingId: `excel_${Date.now()}_${i}`,
        meetingTitle: title,
        billable: false,
        confidence: 1.0
      };
      
      await storageConnector.createEntry(entry);
      imported++;
      
      console.log(`✓ Imported: ${date} | ${project} | ${title} | ${durationHrs}hrs`);
      
    } catch (error) {
      console.log(`✗ Skipped row ${i + 2}: ${error.message}`);
      skipped++;
    }
  }
  
  console.log(`\n=== Import Complete ===`);
  console.log(`Total entries: ${dataRows.length}`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`\nData saved to: data/time-entries.json`);
}

// Run import
importData().catch(console.error);

// Made with Bob
