# Security

Swift Loop is a Figma plugin and a small static preview site. It doesn't talk
to a backend, it doesn't store user data, and its manifest declares
`networkAccess: none`. So the surface for security issues is small — but if you
find something, we'd still like to know.

## Reporting a vulnerability

Please **don't** open a public issue for security reports.

Two ways to reach us privately:

1. Email **mia@swiftner.com** with the details.
2. Or use GitHub's [private vulnerability reporting][gh-advisory] on this repo
   (Security → Report a vulnerability).

Either is fine. Tell us what you found, how to reproduce it, and what you think
the impact is. A screenshot or short screen recording helps a lot.

We'll acknowledge within a few days and keep you posted as we look into it. If
the report leads to a fix, we'll credit you in the release notes unless you'd
rather stay anonymous.

## Supported versions

We patch the latest released version. Older versions don't receive backports.

[gh-advisory]: https://github.com/Swiftner/swift-loop/security/advisories/new
