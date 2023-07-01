const axios = require('axios')
const router = require('express').Router()
const multer = require('multer')
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const resultsDir = process.env.UPLOADS_HOME || "/data/uploads"
    const resultsPath = `${resultsDir}/${Date.now()}`
    console.log("Upload on", resultsPath)
    fs.mkdirSync(resultsPath, { recursive: true })
    cb(null, resultsPath)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({storage: storage})

router.post('/', upload.single("binary"), (req, res) => {
  console.log("Analyzing file:", req.file)
  console.log("Parameters received:", req.body.app)
  const app = JSON.parse(req.body.app)
  const { appName, packageName, version, tests } = app
  const { url, metadata } = app.data
  if(appName == null || appName == "") res.send(400).send({ message: "appName name cannot be null or empty" });
  else if(packageName == null || packageName == "") res.send(400).send({ message: "packageName name cannot be null or empty" });
  else if(version != null && version == "") res.send(400).send({ message: "version name cannot be null or empty" });
  else if(url != null && url == "" && req.file == null) res.send(400).send({ message: "url and binary cannot be null or empty" });
  else if(metadata != null && metadata == "") res.send(400).send({ message: "metadata name cannot be null or empty" });
  else if(tests != null && tests.length == 0) res.send(400).send({ message: "tests name cannot be null or empty" });
  else {
    if(req.file != null) {
      execute(req.file.destination, req.file.path, appName, packageName, version, url, metadata, tests)
      res.status(200).send()
    } else {
      downloadApk(url)
        .then(result => {
          console.log("result.resultsPath: " + result.resultsPath)
          console.log("result.apkPath: " + result.apkPath)
          execute(result.resultsPath, result.apkPath, appName, packageName, version, url, metadata, tests)
          res.status(200).send()
        })
        .catch(error => res.status(500).json({ error: error }))
    }    
  }
})

const downloadApk = (url) => {
  return new Promise((resolve, reject) => {
    const ts = Date.now()
    const resultsDir = process.env.UPLOADS_HOME || "/data/uploads"
    const resultsPath = `${resultsDir}/${ts}`
    fs.mkdirSync(resultsPath, { recursive: true })
    const fileName = `${ts}.apk`
    const output = fs.createWriteStream(`${resultsPath}/${fileName}`)
    console.log("Going to download from:", url)
    console.log("Going to download on:", `${resultsPath}/${fileName}`)
    https.get(url, (res) => {
      console.log('apk download status code:', res.statusCode);
      if(res.statusCode != 200){
        reject({ code: res.statusCode, message: "Error during download" });
        remove(resultsPath)
      } else {
        console.log("Download OK statusCode:", res.statusCode)
      }
      res.pipe(output);
      resolve({ resultsPath: resultsPath, apkPath: `${resultsPath}/${fileName}`})
    }).on('error', (error) => {
      console.log("Error during downlad:", error)
      reject(error)
    });
  })
}

const remove = (resultsPath) => {
  console.log("remove tests for: " + resultsPath)
  // delete directory recursively
  fs.rm(resultsPath, { recursive: true }, err => {
    if (err) {
      throw err
    }

    console.log(`${resultsPath} is deleted!`)
  })
}

const execute = (resultsPath, apkPath, appName, packageName, version, url, metadata, tests) => {
  console.log("Executing tests for:", apkPath)
  const resultsEndpoint = process.env.DELIVER_RESULTS_ENDPOINT || "http://localhost:3000/api/result"
  doTests(resultsPath, apkPath, tests, packageName)
    .then(results => {
      const testResponse = {
        appName: appName,
        packageName: packageName,
        version: version,
        timestamp: Date.now(),
        results: results
      }
      console.log("Sending test response...", testResponse)
      try{
        axios.put(resultsEndpoint, testResponse)
      } catch(error){
        console.log("error:" + error)
      }
    })
    .catch(error => console.log("ERROR:", error))
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function copyFolder(sourceDir, destinationDir, filePattern) {
  // Create destination directory if it doesn't exist

  console.log('##################################')
  console.log('Source directory:', sourceDir)
  console.log('Destination directory:', destinationDir)
  console.log('FilePattern:', filePattern)
  console.log('##################################')

  try{

    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }
  
    // Read all files and subdirectories in the source directory
    try{
      const files = fs.readdirSync(sourceDir);
          // Iterate over each file/directory
      files.forEach((file) => {
      const sourcePath = path.join(sourceDir, file);
      const destinationPath = path.join(destinationDir, file);
  
      // Check if it's a file or directory
      if (fs.lstatSync(sourcePath).isFile()) {
      // If filePattern is provided and file does not match the pattern, skip copying
      if (filePattern && !file.includes(filePattern)) {
        return;
      }

      // Copy files
      fs.copyFileSync(sourcePath, destinationPath);
      console.log(`Copied file: ${sourcePath} to ${destinationPath}`);
      } else {
        // Recursively copy the subdirectory
        copyFolder(sourcePath, destinationPath);
      }
    });
    }catch (err){
      console.error('An error occurred while readdirSync:', err);
    }
    
  }catch (err) {
    console.error('An error occurred while copying the folder:', err);
  } 
}

function searchPatternInIniFiles(directory, pattern, testTime) {
  const results = [];

  // Read the directory contents
  fs.readdirSync(directory).forEach((file) => {
    const filePath = path.join(directory, file);

    // Check if it's a file with the ".ini" extension
    if (fs.lstatSync(filePath).isFile() && path.extname(file).toLowerCase() === '.ini') {
      // Extract the word after "for" in the filename
      const nameMatch = /for\s+(\w+)/i.exec(file);
      const name = nameMatch ? nameMatch[1] : '';

      // Read the contents of the file
      const data = fs.readFileSync(filePath, 'utf8');

      // Use a regular expression to search for the pattern
      const regex = new RegExp(`\\b${pattern}\\b`, 'g');
      const match = regex.exec(data);
      if (match) {
        const value = match[0].split(':')[1].trim();
        results.push({
          name: name,
          parameters: 'Earmo Analyze Tool',
          result: value,
          unit: 'detections',
          optional: testTime.toFixed(3),
        });
      }
    }
  });

  return results;
}


function createTextFile(pathProjecttoAnalize, outputDirectory, filePath) {
  const content = `pathProjecttoAnalize = ${pathProjecttoAnalize}
##/CH/ifa/draw
populationSize =100
maxEvaluations =1000
initialSizeRefactoringSequence =0
##329
crossOverProbability=0.8
mutationProbability=0.8
maxTimeExecutionMs=0
qmood =0
#modes 0 class files; 1 java files; 2 jar files
generateFromSourceCode=1
generateAllRefOpp=1
initialcountAntipatterns=1
copyRelevantDirs=0
#for linux to fix the problem of Wilcoxon R files with wrong path
#ResultsTesting/
outputDirectory = ${outputDirectory}
#./ResultsTesting/
Trace=0
Threads=4
initialSizeRefactoringSequencePerc=50
independentRuns=1
## Joules expressed in double format. This value has to be >0 if not the Energy usage of an app will be 0
originalAppEnergyUsage=21.28127
detectedAntipatterns=LargeClassLowCohesion,Blob,RefusedParentBequest,LazyClass,LongParameterList,SpaghettiCode,SpeculativeGenerality,BindingResources2Early,ReleasingResources2Late,InternalGetterAndSettersAndroid,HashMapUsageAndroid
#RefusedParentBequest,LazyClass,LongParameterList,SpaghettiCode,LargeClassLowCohesion,Blob,SpeculativeGenerality,BindingResources2Early,ReleasingResources2Late,InternalGetterAndSettersAndroid,HashMapUsageAndroid
androidEnergyDeltas=deltas.txt`;

  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error('Error creating the file:', err);
      return;
    }
    console.log('Config file created successfully!');
  });
}

const doTests = (resultsPath, apkPath, tests, packageName) => {
  return new Promise(async (resolve, reject) => {
    const earmoHome = process.env.EARMO_HOME

    console.log("resultsPath: " + resultsPath);
    const fileName = path.basename(resultsPath);
    console.log("fileName:" + fileName);
    console.log("apkPath: " + apkPath);
    console.log("packageName: " + packageName);

    const timeoutStart = Date.now()
    var testTime = 0
    
    var cmd = `cd ${resultsPath} && time ${earmoHome}/jadx/bin/jadx ${apkPath} -d ${resultsPath}/jadx`;
    console.log("cmd: "+cmd);
    await delay(2000); // Delay of 2000 milliseconds (2 seconds)

    try {
      const output = execSync(cmd);
      console.log(`Command jadx output: ${output.toString()}`);
    } catch (err) {
      console.error(`Command jadx execution error: ${err}`);
      reject(err);
    }
    
    console.log("Copy source files ...")
    const packagePath = `/${packageName.split('.').slice(0, 2).join('/')}/`;
    console.log("packagePath:" + packagePath);
    const sourceDirectory = `${resultsPath}/jadx/sources/` + packagePath;
    const destinationDirectory = `${resultsPath}/sources/` + packagePath;
    
    try {
      copyFolder(sourceDirectory, destinationDirectory);
    } catch (err) {
      console.error('An error occurred:', err);
      reject(err);
    }

    const outputDirectory = `${resultsPath}/test`;
    const filePath = `${resultsPath}/my_conf.prop`;

    createTextFile(destinationDirectory, outputDirectory, filePath);

    try {
      copyFolder(`${earmoHome}/earmo_executable/`, `${earmoHome}/earmo_bin/${fileName}/`);
    } catch (err) {
      console.error('An error occurred copying earmo_executable:', err);
      reject(err);
    }

    var cmd = `cd ${earmoHome}/earmo_bin/${fileName}/ && ls && time java -jar RefactoringStandarStudyAndroid.jar ${filePath}`;
    console.log("cmd: "+cmd);
    await delay(2000); // Delay of 2000 milliseconds (2 seconds)

    try {
      const output = execSync(cmd);
      console.log(`Command earmo output: ${output.toString()}`);
    } catch (error) {
      console.error(`Command earmo execution error: ${error}`);
    }
        
    const directory = `${earmoHome}/earmo_bin/${fileName}/`;
    const pattern = 'Total:\\d+';

    console.log("Test time (ms): " + (Date.now() - timeoutStart) ) // Test time in seconds
    testTime = (Date.now() - timeoutStart) / 1000 / 60
    console.log("Test time (minutes): " + testTime ) // Test time in minutes

    const searchResults = searchPatternInIniFiles(directory, pattern, testTime);
    console.log(JSON.stringify(searchResults, null, 2));

    remove(directory);
    remove(resultsPath);

    resolve(searchResults);
  })
}

module.exports = router