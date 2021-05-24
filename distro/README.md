# Quanta Distro

### How to run a Quanta instance

To run a Quanta instance from the Docker Public Repository you can simply unzip the `quanta-1.0.1.tar.gz` onto a linux machine, and then start the app with `run-distro.sh`. This will create a minimal installation running at `http://localhost:8185`, and will be persisting all data into a MongoDB in the `\data` subfolder inside your distro folder. To stop the app run `stop-distro.sh`. To run on a different port, just edit the `docker-compose-distro.yaml`. If you want to customize the branding you can replace or edit the content in the `config` and/or `branding` folders.

The only prerequisite is that you need to have `docker-compose` installed first.

NOTE: You should edit the password in `mongo.env` and `secrets.sh`, before your first run, and that password will become your `admin` user password which you can use to login as the `admin` user. This same password will be securing your MongoDB instance and will also be the admin password for the Web App.

### IMPORTANT: 

Be sure to update this line in setenv--distro.sh to have your own domain/ip:
    
    export quanta_domain=localhost


### Linux Commands

```sh
# To install docker (in case you don't have it already)
# This command will install a recent enough docker-compose on # Ubuntu 20.04, but if you're on some other Linux 
# version you'll need to install support for docker-compose yaml version 3.7 
sudo apt install docker
sudo apt install docker-compose

# Download distro from github
# (Note: The url here is obtained by right-click on 'view raw' in the github, and so you could also get this
# file using by browsing to github for it if you want)
curl -o quanta1.0.3.tar.gz \
     -LJO https://github.com/Clay-Ferguson/quantizr/blob/master/distro/quanta1.0.3.tar.gz?raw=true

# Unzip to create quanta-distro folder, and run from there
tar vxf quanta1.0.3.tar.gz
cd quanta-distro

# Run Quanta WebApp (at port 8185)
sudo ./run-distro.sh
```

The following tip is for less-technical users, but most people will be running from a Linode instance or similar and so it won't apply:

TIP: For the most secure environment run this in a VirtualBox instance and then open port 8185 by selecting `Settings -> Network -> Advanced -> Port Forwarding` and then adding a TCP Protocol entry that maps Host port 8185 to Guest Port 8185. Then you can browse the app from your host machine. Of course to make the app visible to the rest of the internet you'd need to open this port on your Router also.

****

**Welcome to the Fediverse!**

