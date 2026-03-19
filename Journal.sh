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
git commit -m "modification de l'API"
git push origin api

#lanch server 
node server.js

#lanch client
node client.js