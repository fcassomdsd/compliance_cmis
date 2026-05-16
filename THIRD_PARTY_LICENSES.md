# Third-party licenses

This repository is licensed under Apache License 2.0 for original project code and documentation.

Runtime dependencies and container images used by this project are provided by third parties and remain under their respective licenses and terms.

## Container images referenced by docker-compose.yml

| Image | Upstream project/vendor | License source |
|---|---|---|
| alfresco/alfresco-governance-repository-community:25.2.0 | Hyland Alfresco (ACS/AGS) | Check upstream image/package documentation and embedded license notices |
| alfresco/alfresco-governance-share-community:25.2.0 | Hyland Alfresco (Share) | Check upstream image/package documentation and embedded license notices |
| alfresco/alfresco-transform-core-aio:5.2.0 | Hyland Alfresco Transform Service | Check upstream image/package documentation and embedded license notices |
| alfresco/alfresco-search-services:2.0.16 | Hyland Alfresco Search Services (Solr) | Check upstream image/package documentation and embedded license notices |
| alfresco/alfresco-activemq:5.18-jre17-rockylinux8 | Hyland Alfresco / Apache ActiveMQ distribution | Check upstream image/package documentation and embedded license notices |
| postgres:16.5 | PostgreSQL Global Development Group | PostgreSQL License |

## How to maintain this file

1. Add new third-party libraries, images, or tooling when introduced.
2. Record version numbers used in this repository.
3. Link to the canonical license source where possible.
4. Preserve required attribution and notice text when redistributing.

## Important note

This file is an operational tracking document, not legal advice.
For commercial redistribution or productization, perform a legal review of all third-party license obligations.
