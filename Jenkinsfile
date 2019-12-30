pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        echo "${env.WORKSPACE}"
        echo "${env.JENKINS_URL}"
        sh 'pwd'
        sh 'ls -l'
        nodejs(nodeJSInstallationName: 'Node.JS v6') {
            sh 'npm --version'
            sh 'npm config list'
            sh 'node --version'
            sh 'npm install'
            sh 'npm test'
            sh 'npm run test:system'
        }
        nodejs(nodeJSInstallationName: 'Node.JS v8') {
            sh 'npm --version'
            sh 'npm config list'
            sh 'node --version'
            sh 'npm install'
            sh 'npm test'
            sh 'npm run test:system'
        }
        nodejs(nodeJSInstallationName: 'Node.JS v10') {
            sh 'npm --version'
            sh 'npm config list'
            sh 'node --version'
            sh 'npm install'
            sh 'npm test'
            sh 'npm run test:system'
        }
        nodejs(nodeJSInstallationName: 'Node.JS v12') {
            sh 'npm --version'
            sh 'npm config list'
            sh 'node --version'
            sh 'npm install'
            sh 'npm test'
            sh 'npm run test:system'
        }
      }
    }
  }
}
