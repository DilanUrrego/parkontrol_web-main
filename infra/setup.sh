#!/usr/bin/env bash  
set -euo pipefail  
  
echo "==> Creando red devops-net..."  
# El standard en Bash para ignorar si existe es este:
docker network create devops-net 2>/dev/null || echo "Red ya existe, continuando."  
  
echo "==> Levantando Jenkins..."  
# CRÍTICO: No dejes espacios después de la barra \
docker run -d --name jenkins --network devops-net --restart always -p 8080:8080 -v jenkins_home:/var/jenkins_home -v /var/run/docker.sock:/var/run/docker.sock jenkins/jenkins:lts-jdk21  
  
echo "==> Levantando SonarQube..."  
docker run -d --name sonarqube --network devops-net --restart always -p 9000:9000 -v sonarqube_data:/opt/sonarqube/data -v sonarqube_logs:/opt/sonarqube/logs -v sonarqube_extensions:/opt/sonarqube/extensions sonarqube:community  
  
echo ""  
echo "Jenkins   -> http://localhost:8080"  
echo "SonarQube -> http://localhost:9000"  
echo ""  

# Esperar a que el archivo se genere (Jenkins tarda un poco en el primer inicio)
echo "Esperando a que Jenkins genere la contraseña..."
sleep 15 

echo "Contraseña inicial de Jenkins:"  
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword || echo "El archivo aún no está listo, revisa los logs con: docker logs jenkins"