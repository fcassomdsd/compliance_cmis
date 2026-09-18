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

## Worst-case scenarios for legal review

Two questions are open for counsel (`compliance_cmis`'s own webscripts/content-model customizations vs. the four LGPL-3.0 images above). Worked through here as a best-faith walkthrough of LGPLv3's actual mechanics, not legal advice — the point is to size the exposure before commissioning review, not to substitute for it.

**Question 1 — does publishing this repository count as "distribution"/"conveying" under LGPLv3?**

Worst case: yes. An aggressive reading treats publishing `docker-compose.yml` (which pins Alfresco's official images), deployment scripts, webscripts designed to run inside that specific instance, and documentation as "conveying" a functional system in which Alfresco's LGPL code is an integral, load-bearing part, not just incidentally compatible software.

Even in that worst case, LGPLv3 §4 ("Combined Works") is written for exactly this scenario and does **not** require relicensing anything of this repository's own code. It requires: prominent notice that the Library (Alfresco) is used and is LGPL-3.0; copies of the GPL-3.0 and LGPL-3.0 license texts; preservation of Alfresco's own copyright notices; and that the user can modify the Library and debug against a modified version. That last condition is already satisfied by the architecture — Alfresco is referenced by a plain `image:` tag in `docker-compose.yml`, so any adopter can already substitute a different tag or a self-built Alfresco image without touching this repository's code at all. **Worst-case remedy: a documentation/notice task** (formal LGPL/GPL license-text files, a clearer "this uses Alfresco Content Services, LGPL-3.0, here's where to get its source" notice) — not re-licensing or code disclosure.

**Question 2 — are the webscripts/content-model customizations a derivative work of Alfresco?**

Worst case: yes. Webscripts run *inside* Alfresco's own JVM/Rhino engine, calling Alfresco's internal Java service APIs directly (`companyhome.childByNamePath()`, `search.luceneSearch()`, etc.) — tighter coupling than a separate process talking over a network API. An aggressive reading could call that closer to "a modified version of the Library" than "a work that merely uses it through a documented interface" — the same genuinely-debated grey area as the WordPress-plugin-GPL question in ecosystems with a plugin/extension convention.

Even in that worst case, LGPLv3 §4 still applies and still permits conveying the combining code under Apache-2.0, subject to the same conditions as Question 1 — §4 doesn't gate on "is this a derivative work or not" before granting that permission; it applies to combined works generally. **The only scenario where this repository's own code would actually have to become LGPL-licensed is if Alfresco's own source or compiled binaries were themselves modified and redistributed** (e.g. a patched, recompiled, republished Alfresco image) — not the case today: the Alfresco containers stay pristine, unmodified upstream images, and the webscripts are separate files loaded through Alfresco's own documented extension mechanism, not compiled into Alfresco's own JARs.

**Net read**: in both worst-case findings, the remedy converges on notice/license-text compliance, not re-licensing or source disclosure of this repository's own code — structurally milder than strong-copyleft exposure (contrast `atrocore-docker/THIRD_PARTY_LICENSES.md`'s GPL-3.0 worst case, which has no equivalent built-in permission). **One standing constraint worth keeping regardless of counsel's answer**: never build or publish a *modified* Alfresco image. The moment Alfresco's own code is patched and redistributed rather than referenced-and-configured, LGPL's stricter "modified version" conditions apply and this analysis gets materially harder.

## How to maintain this file

1. Add new third-party libraries, images, or tooling when introduced.
2. Record version numbers used in this repository.
3. Link to the canonical license source where possible.
4. Preserve required attribution and notice text when redistributing.

## Important note

This file is an operational tracking document, not legal advice.
For commercial redistribution or productization, perform a legal review of all third-party license obligations.
