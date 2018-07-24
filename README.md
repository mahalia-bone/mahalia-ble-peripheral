# Build Instructions

Host system is Debian Sid.

Install pbuilder-dist:
```
$ sudo apt-get install ubuntu-dev-tools
```

Configure pbuilder:
```
$ echo "PBUILDERSATISFYDEPENDSCMD=/usr/lib/pbuilder/pbuilder-satisfydepends-apt" >> ~/.pbuilderrc
$ echo "USENETWORK=yes" >> ~/.pbuilderrc
```

Create a rootfs:
```
$ pbuilder-dist buster armhf create
```


Update the rootfs:
```
$ pbuilder-dist buster armhf update
```

Build the package (from the repository root):
```
# (source package, ignore .git folders, arch armhf, do not sign, do not check depends)

$ dpkg-buildpackage -S -I.git -aarmhf --no-sign -d
$ pbuilder-dist buster armhf build ../mahalia-ble-peripheral_*.dsc
```
