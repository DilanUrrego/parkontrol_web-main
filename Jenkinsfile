pipeline {
    agent any

    tools {
        nodejs 'node20' 
    }

    environment {
        SONAR_SERVER  = 'SonarQube'
        SONAR_TOKEN   = credentials('sonarqube-token')
        BE_IMAGE      = 'parkontrol-backend'
        BE_CONTAINER  = 'parkontrol-api'
        BE_HOST_PORT  = '8000'
        BE_APP_PORT   = '3000'
        FE_IMAGE      = 'parkontrol-frontend'
        FE_CONTAINER  = 'parkontrol-web'
        FE_HOST_PORT  = '4200'
    }

    stages {
        stage('Clean Workspace') {
            steps {
                script {
                    sh '''
                        echo "=== Limpiando workspace ==="
                        # Limpiar node_modules usando Docker
                        docker run --rm -v $(pwd):/workspace alpine sh -c "rm -rf /workspace/backend/node_modules /workspace/frontend-angular/node_modules /workspace/frontend-angular/.angular 2>/dev/null || true"
                        # Limpiar caché de npm
                        npm cache clean --force || true
                        echo "=== Workspace limpio ==="
                    '''
                }
            }
        }

        stage('Install Dependencies') {
            parallel {
                stage('Backend – Install') {
                    steps {
                        dir('backend') { 
                            sh 'npm ci'
                        }
                    }
                }
                stage('Frontend – Install') {
                    steps {
                        dir('frontend-angular') { 
                            sh '''
                                # Intentar con permisos forzados
                                npm install --force || npm ci --force
                            '''
                        }
                    }
                }
            }
        }

        stage('Run Tests') {
            parallel {
                stage('Backend – Tests') {
                    steps {
                        dir('backend') { 
                            sh 'npm run test:cov -- --testPathIgnorePatterns=".*\\\\.integration\\\\..*"' 
                        }
                    }
                }
                stage('Frontend – Tests') {
                    agent {
                        docker { 
                            image 'trion/ng-cli-karma:latest'
                            args '-u 1000:1000'  // CRUCIAL: No usar root
                            reuseNode true
                        }
                    }
                    steps {
                        dir('frontend-angular') {
                            script {
                                // Limpiar completamente
                                sh 'rm -rf node_modules package-lock.json .angular'
                                // Instalar dependencias
                                sh 'npm install'
                                // Ejecutar pruebas
                                sh 'npx ng test --watch=false --browsers=ChromeHeadless --no-watch'
                            }
                        }
                    }
                }
            }
        }

        stage('SonarQube Analysis') {
            parallel {
                stage('Backend – Sonar') {
                    steps {
                        dir('backend') {
                            withSonarQubeEnv("${SONAR_SERVER}") {
                                sh "npx sonar-scanner -Dsonar.token=${SONAR_TOKEN}"
                            }
                        }
                    }
                }
                stage('Frontend – Sonar') {
                    steps {
                        dir('frontend-angular') {
                            withSonarQubeEnv("${SONAR_SERVER}") {
                                sh "npx sonar-scanner -Dsonar.token=${SONAR_TOKEN}"
                            }
                        }
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Docker Build') {
            parallel {
                stage('Backend – Build Image') {
                    steps {
                        dir('backend') {
                            sh "docker build -t ${BE_IMAGE}:${BUILD_NUMBER} -t ${BE_IMAGE}:latest ."
                        }
                    }
                }
                stage('Frontend – Build Image') {
                    steps {
                        dir('frontend-angular') {
                            sh "docker build -t ${FE_IMAGE}:${BUILD_NUMBER} -t ${FE_IMAGE}:latest ."
                        }
                    }
                }
            }
        }

        stage('Deploy') {
            parallel {
                stage('Backend – Deploy') {
                    steps {
                        sh """
                            docker stop ${BE_CONTAINER} 2>/dev/null || true
                            docker rm ${BE_CONTAINER} 2>/dev/null || true
                            docker run -d --name ${BE_CONTAINER} \\
                                --network devops-net \\
                                --restart always \\
                                -p ${BE_HOST_PORT}:${BE_APP_PORT} \\
                                -e PORT=${BE_APP_PORT} \\
                                ${BE_IMAGE}:latest
                        """
                    }
                }
                stage('Frontend – Deploy') {
                    steps {
                        sh """
                            docker stop ${FE_CONTAINER} 2>/dev/null || true
                            docker rm ${FE_CONTAINER} 2>/dev/null || true
                            docker run -d --name ${FE_CONTAINER} \\
                                --network devops-net \\
                                --restart always \\
                                -p ${FE_HOST_PORT}:80 \\
                                ${FE_IMAGE}:latest
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            echo "Despliegue exitoso."
            echo "API  -> http://localhost:${BE_HOST_PORT}"
            echo "Web  -> http://localhost:${FE_HOST_PORT}"
        }
        always {
            script {
                sh '''
                    docker image prune -f
                    # Limpiar node_modules después de cada build
                    docker run --rm -v $(pwd):/workspace alpine sh -c "rm -rf /workspace/backend/node_modules /workspace/frontend-angular/node_modules 2>/dev/null || true"
                '''
            }
        }
        failure {
            echo "Pipeline falló. Revisa los logs para más detalles."
        }
    }
}