pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        echo "${env.WORKSPACE}"
        echo "${env.JENKINS_URL}"
        sh 'pwd'
        sh 'ls -l'
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
