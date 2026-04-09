# Créer un nouveau dépôt GitHub 
git init
git branch -M main
git add .
git commit -m "first commit"
gh repo create webservice --public
git remote add origin https://github.com/JXPM/webservice.git
git push --set-upstream origin main



#fichier Maj et push
git status
git add .
git commit -m "Maj"
git push origin main

#lanch server 
node server.js

#lanch client
node client.js

#lanch docker
docker run --name postgres -p 5432:5432 \
	-e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mydb \
	-v ./init.sql:/docker-entrypoint-initdb.d/init.sql -d postgres