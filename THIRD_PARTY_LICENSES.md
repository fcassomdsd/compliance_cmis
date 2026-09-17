# Third-party licenses

This repository is licensed under Apache License 2.0 for original project code and documentation.

Runtime dependencies and container images used by this project are provided by third parties and remain under their respective licenses and terms.

## Container images referenced by docker-compose.yml

Verified by pulling each image locally and checking directly: the running images
themselves carry **no bundled LICENSE/NOTICE for the Alfresco application code** — the
only license file present at the Tomcat root (`/usr/local/tomcat/LICENSE`, `NOTICE`) is
Apache Tomcat's own license, unrelated to Alfresco. The `alfresco-repository`,
`alfresco-core`, and `alfresco-data-model` JARs deployed inside the repository image
carry no internal LICENSE/NOTICE either. The license determination below therefore comes
from each component's upstream source repository, not from anything self-declared in the
shipped runtime artifact — worth noting for legal review as its own minor point: the
compliance burden here includes *locating* the license, not just complying with it.

| Image | Upstream source repo | License (confirmed against upstream `LICENSE`/repo metadata) |
|---|---|---|
| alfresco/alfresco-governance-repository-community:25.2.0 | `Alfresco/alfresco-community-repo` | **LGPL-3.0** |
| alfresco/alfresco-governance-share-community:25.2.0 | `Alfresco/share` | **LGPL-3.0** |
| alfresco/alfresco-transform-core-aio:5.2.0 | `Alfresco/alfresco-transform-core` | **LGPL-3.0** (bundles PDFium, BSD-3-Clause, found directly at `/usr/bin/LICENSE` in the image) |
| alfresco/alfresco-search-services:2.0.16 | `Alfresco/SearchServices` | **LGPL-3.0** |
| alfresco/alfresco-activemq:5.18-jre17-rockylinux8 | Apache ActiveMQ (`apache/activemq`), packaged by `Alfresco/alfresco-docker-activemq` | **Apache-2.0** — not LGPL; this is the one image in this set that is *not* LGPL-3.0, both for the broker itself and Alfresco's own Docker packaging of it |
| postgres:16.5 | PostgreSQL Global Development Group | PostgreSQL License |

## How to maintain this file

1. Add new third-party libraries, images, or tooling when introduced.
2. Record version numbers used in this repository.
3. Link to the canonical license source where possible.
4. Preserve required attribution and notice text when redistributing.

## Important note

This file is an operational tracking document, not legal advice.
For commercial redistribution or productization, perform a legal review of all third-party license obligations.
