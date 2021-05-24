#!/bin/bash

# =================================================================================================
# Builds a production distro zip file, which should be able to be unzipped and run on any
# linux box to run an instance of the app, with all default settings. Startup scripts in this zip file should
# be able to be run by non-developers and is stand-alone, with minimal setup required
# to get an instance of Quanta up and running
# =================================================================================================

clear
# show commands as they are run.
# set -x

source ./setenv--distro.sh

# sanity check since we do "rm -rf" in here
if [ -z "$DEPLOY_TARGET" ]; then exit; fi
sudo rm -rf ${DEPLOY_TARGET}/*
verifySuccess "Cleaned deploy target"

mkdir -p ${DEPLOY_TARGET}

cd ${PRJROOT}
cp ${PRJROOT}/docker-compose-distro.yaml ${DEPLOY_TARGET}
# Tip: This replaces the "#build-snippet" tag in the yaml with the content of file build-snippet.yaml
sed -i -e "/#build-snippet/rbuild-snippet.yaml" ${DEPLOY_TARGET}/docker-compose-distro.yaml

cp ${PRJROOT}/dockerfile-distro ${DEPLOY_TARGET}
cp ${PRJROOT}/entrypoint.sh ${DEPLOY_TARGET}

# copy scripts needed to start/stop to deploy target
cp ${SCRIPTS}/run-distro.sh                 ${DEPLOY_TARGET}
cp ${SCRIPTS}/stop-distro.sh                ${DEPLOY_TARGET}
cp ${SCRIPTS}/define-functions.sh           ${DEPLOY_TARGET}
cp ${SCRIPTS}/setenv--distro-runner.sh      ${DEPLOY_TARGET}
cp ${PRJROOT}/distro/README.sh              ${DEPLOY_TARGET}

# this is a special file we alter the owner of in the run script.
cp ${SCRIPTS}/mongod--distro.conf           ${DEPLOY_TARGET}/mongod.conf

# Note: this 'dumps' folder is mapped onto a volume in 'docker-compose-distro.yaml' and the 'backup-local.sh'
#       script should only be run from 'inside' the docker container, which is what 'mongodb-backup.sh' actually does.
mkdir -p ${DEPLOY_TARGET}/dumps
mkdir -p ${DEPLOY_TARGET}/config

# copy our secrets (passwords, etc) to deploy location
# cp ${PRJROOT}/secrets/secrets.sh                  ${DEPLOY_TARGET}/dumps/secrets.sh
cp ${PRJROOT}/secrets/secrets.sh    ${DEPLOY_TARGET}
cp ${PRJROOT}/secrets/mongo.env     ${DEPLOY_TARGET}

# Default app configs
cp ${PRJROOT}/src/main/resources/config-text-distro.yaml    ${DEPLOY_TARGET}/config

# copy our banding folder to deploy target
rsync -aAX --delete --force --progress --stats "${PRJROOT}/branding/" "${DEPLOY_TARGET}/branding/"

# ensure the IPFS folders exist
mkdir -p ${ipfs_data}
mkdir -p ${ipfs_staging}

# Wipe previous springboot fat jar to ensure it can't be used again.
rm -f ${PRJROOT}/target/org.subnode-0.0.1-SNAPSHOT.jar

# build the project (comile source)
cd ${PRJROOT}
. ${SCRIPTS}/_build.sh

# Create Image
#
# Since we create the image we can also now go run the app directly from ${DEPLOY_TARGET} on this machine 
# if we wanted to and since the image is local it won't be pulling from Public Docker Repo, but as 
# stated in the note below once we do publish to the repo then the TAR file we just created in this script
# will work on all machines anywhere across the web.
cp ${PRJROOT}/target/org.subnode-0.0.1-SNAPSHOT.jar ${DEPLOY_TARGET}
verifySuccess "JAR copied to build distro"

# This builds the image locally, and saves it into local docker repository, so that 'docker-compose up',
# is all that's required.
cd ${DEPLOY_TARGET}
dockerBuild

# Now fix up the DEPLOY_TARGET and for end users, and zip it
cp ${PRJROOT}/docker-compose-distro.yaml ${DEPLOY_TARGET}
rm -f ${DEPLOY_TARGET}/dockerfile-distro
rm -f ${DEPLOY_TARGET}/org.subnode-0.0.1-SNAPSHOT.jar

TARGET_PARENT="$(dirname "${DEPLOY_TARGET}")"
cd ${TARGET_PARENT}

tar -zcvf ${PRJROOT}/distro/quanta${QUANTA_VER}.tar.gz quanta-distro
#NOTE: Extraction command will be: `tar vxf quanta1.0.3.tar.gz`
verifySuccess "TAR created"

echo
echo "==================== IMPORTANT ======================================="
echo "Run docker-publish-distro.sh to actually publish the distro."
echo "You can test locally (before publishing) by running:"
echo "${DEPLOY_TARGET}/run-distro.sh"
echo "======================================================================"
echo 
echo "Build Complete: ${PRJROOT}/distro/quanta${QUANTA_VER}.tar.gz"