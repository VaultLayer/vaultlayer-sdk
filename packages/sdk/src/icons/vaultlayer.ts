const vaultlayer =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMzg1IiB6b29tQW5kUGFuPSJtYWduaWZ5IiB2aWV3Qm94PSIwIDAgMjg4Ljc1IDI4OC43NDk5ODkiIGhlaWdodD0iMzg1IiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCBtZWV0IiB2ZXJzaW9uPSIxLjAiPjxkZWZzPjxjbGlwUGF0aCBpZD0iNzU2NDBiZGYyMSI+PHBhdGggZD0iTSAwIDAgTCAyODcuOTAyMzQ0IDAgTCAyODcuOTAyMzQ0IDI4Ny45MDIzNDQgTCAwIDI4Ny45MDIzNDQgWiBNIDAgMCAiIGNsaXAtcnVsZT0ibm9uemVybyIvPjwvY2xpcFBhdGg+PGNsaXBQYXRoIGlkPSI3MzQ2ZWI1NGJjIj48cGF0aCBkPSJNIDE0My45NDkyMTkgMCBDIDY0LjQ0OTIxOSAwIDAgNjQuNDQ5MjE5IDAgMTQzLjk0OTIxOSBDIDAgMjIzLjQ1MzEyNSA2NC40NDkyMTkgMjg3LjkwMjM0NCAxNDMuOTQ5MjE5IDI4Ny45MDIzNDQgQyAyMjMuNDUzMTI1IDI4Ny45MDIzNDQgMjg3LjkwMjM0NCAyMjMuNDUzMTI1IDI4Ny45MDIzNDQgMTQzLjk0OTIxOSBDIDI4Ny45MDIzNDQgNjQuNDQ5MjE5IDIyMy40NTMxMjUgMCAxNDMuOTQ5MjE5IDAgWiBNIDE0My45NDkyMTkgMCAiIGNsaXAtcnVsZT0ibm9uemVybyIvPjwvY2xpcFBhdGg+PGNsaXBQYXRoIGlkPSIyYzExZDU0MWI2Ij48cGF0aCBkPSJNIDE0NC4zOTQ1MzEgMTIwLjg4NjcxOSBMIDE5My43NDYwOTQgMTIwLjg4NjcxOSBMIDE5My43NDYwOTQgMTcwLjI0MjE4OCBMIDE0NC4zOTQ1MzEgMTcwLjI0MjE4OCBaIE0gMTQ0LjM5NDUzMSAxMjAuODg2NzE5ICIgY2xpcC1ydWxlPSJub256ZXJvIi8+PC9jbGlwUGF0aD48Y2xpcFBhdGggaWQ9Ijc2MjA3ZDk3ZWMiPjxwYXRoIGQ9Ik0gMTY5LjA3MDMxMiAxMjAuODg2NzE5IEMgMTU1LjQ0MTQwNiAxMjAuODg2NzE5IDE0NC4zOTQ1MzEgMTMxLjkzNzUgMTQ0LjM5NDUzMSAxNDUuNTY2NDA2IEMgMTQ0LjM5NDUzMSAxNTkuMTk1MzEyIDE1NS40NDE0MDYgMTcwLjI0MjE4OCAxNjkuMDcwMzEyIDE3MC4yNDIxODggQyAxODIuNjk5MjE5IDE3MC4yNDIxODggMTkzLjc0NjA5NCAxNTkuMTk1MzEyIDE5My43NDYwOTQgMTQ1LjU2NjQwNiBDIDE5My43NDYwOTQgMTMxLjkzNzUgMTgyLjY5OTIxOSAxMjAuODg2NzE5IDE2OS4wNzAzMTIgMTIwLjg4NjcxOSBaIE0gMTY5LjA3MDMxMiAxMjAuODg2NzE5ICIgY2xpcC1ydWxlPSJub256ZXJvIi8+PC9jbGlwUGF0aD48Y2xpcFBhdGggaWQ9Ijk0MTU0NzEzNWYiPjxwYXRoIGQ9Ik0gMTE0LjkwNjI1IDEzMy42MjEwOTQgTCAxNzMuODg2NzE5IDEzMy42MjEwOTQgTCAxNzMuODg2NzE5IDE1Ny41MTE3MTkgTCAxMTQuOTA2MjUgMTU3LjUxMTcxOSBaIE0gMTE0LjkwNjI1IDEzMy42MjEwOTQgIiBjbGlwLXJ1bGU9Im5vbnplcm8iLz48L2NsaXBQYXRoPjxjbGlwUGF0aCBpZD0iMWRhMzQ4MjI3OSI+PHBhdGggZD0iTSAxNTkuMTM2NzE5IDEzMy42MjEwOTQgQyAxNjcuMjc3MzQ0IDEzMy42MjEwOTQgMTczLjg3ODkwNiAxMzguOTY4NzUgMTczLjg3ODkwNiAxNDUuNTY2NDA2IEMgMTczLjg3ODkwNiAxNTIuMTY0MDYyIDE2Ny4yNzczNDQgMTU3LjUxMTcxOSAxNTkuMTM2NzE5IDE1Ny41MTE3MTkgTCAxMjkuNjQ4NDM4IDE1Ny41MTE3MTkgQyAxMjEuNTA3ODEyIDE1Ny41MTE3MTkgMTE0LjkwNjI1IDE1Mi4xNjQwNjIgMTE0LjkwNjI1IDE0NS41NjY0MDYgQyAxMTQuOTA2MjUgMTM4Ljk2ODc1IDEyMS41MDc4MTIgMTMzLjYyMTA5NCAxMjkuNjQ4NDM4IDEzMy42MjEwOTQgWiBNIDE1OS4xMzY3MTkgMTMzLjYyMTA5NCAiIGNsaXAtcnVsZT0ibm9uemVybyIvPjwvY2xpcFBhdGg+PC9kZWZzPjxnIGNsaXAtcGF0aD0idXJsKCM3NTY0MGJkZjIxKSI+PGcgY2xpcC1wYXRoPSJ1cmwoIzczNDZlYjU0YmMpIj48cGF0aCBmaWxsPSIjZGQ2MjJkIiBkPSJNIDAgMCBMIDI4Ny45MDIzNDQgMCBMIDI4Ny45MDIzNDQgMjg3LjkwMjM0NCBMIDAgMjg3LjkwMjM0NCBaIE0gMCAwICIgZmlsbC1vcGFjaXR5PSIxIiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48L2c+PC9nPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgdHJhbnNmb3JtPSJtYXRyaXgoMC43NDkzNTEsIDAsIDAsIDAuNzQ5MzUxLCA1Ni44MjUxNCwgNjMuNDcyNjc4KSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgZD0iTSAxNi4wMDIxOTkgMTUuOTk4MTg3IEwgMjE2LjUzNTA2MSAxNS45OTgxODcgIiBzdHJva2U9IiMwZjE4MTkiIHN0cm9rZS13aWR0aD0iMzIiIHN0cm9rZS1vcGFjaXR5PSIxIiBzdHJva2UtbWl0ZXJsaW1pdD0iNCIvPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgdHJhbnNmb3JtPSJtYXRyaXgoMC43NDkzNTEsIDAsIDAsIDAuNzQ5MzUxLCA1Ni44MjUxNCwgMjAwLjQ0OTczNSkiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIGQ9Ik0gMTYuMDAyMTk5IDE1Ljk5NzUyNyBMIDIxNi41MzUwNjEgMTUuOTk3NTI3ICIgc3Ryb2tlPSIjMGYxODE5IiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2Utb3BhY2l0eT0iMSIgc3Ryb2tlLW1pdGVybGltaXQ9IjQiLz48cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHRyYW5zZm9ybT0ibWF0cml4KDAuMDAwMDAwMDAxMzA3ODYsIDAuNzQ5MzUxLCAtMC43NDkzNTEsIDAuMDAwMDAwMDAxMzA3ODYsIDIzMS4yMjcyNDcsIDY2Ljg1Mzk0MikiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIGQ9Ik0gMTYuMDAwMjUzIDE1Ljk5OTEyOSBMIDE5NC4wODE0IDE1Ljk5OTEyOSAiIHN0cm9rZT0iIzBmMTgxOSIgc3Ryb2tlLXdpZHRoPSIzMiIgc3Ryb2tlLW9wYWNpdHk9IjEiIHN0cm9rZS1taXRlcmxpbWl0PSI0Ii8+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiB0cmFuc2Zvcm09Im1hdHJpeCgwLCAwLjc0OTM1MSwgLTAuNzQ5MzUxLCAwLCA4MC42NDc0MDIsIDY2Ljg1ODE1NSkiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIGQ9Ik0gMTUuOTk5ODQ0IDE2LjAwMjA0NiBMIDQxLjIxOTU3OSAxNi4wMDIwNDYgIiBzdHJva2U9IiMwZjE4MTkiIHN0cm9rZS13aWR0aD0iMzIiIHN0cm9rZS1vcGFjaXR5PSIxIiBzdHJva2UtbWl0ZXJsaW1pdD0iNCIvPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgdHJhbnNmb3JtPSJtYXRyaXgoMCwgMC43NDkzNTEsIC0wLjc0OTM1MSwgMCwgODAuNjQ3NDAyLCAxODEuNDA2Nzc1KSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgZD0iTSAxNS45OTc1MTUgMTYuMDAyMDQ2IEwgNDEuMjE3MjUgMTYuMDAyMDQ2ICIgc3Ryb2tlPSIjMGYxODE5IiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2Utb3BhY2l0eT0iMSIgc3Ryb2tlLW1pdGVybGltaXQ9IjQiLz48cGF0aCBzdHJva2UtbGluZWNhcD0iYnV0dCIgdHJhbnNmb3JtPSJtYXRyaXgoMCwgMC43NDkzNTEsIC0wLjc0OTM1MSwgMCwgODAuNjQ5OTI3LCAxMzMuNjIyMzA3KSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgZD0iTSAtMC4wMDE2MTg3OSAxNi4wMDAyMDMgTCAzMS44ODAxMyAxNi4wMDAyMDMgIiBzdHJva2U9IiMwZjE4MTkiIHN0cm9rZS13aWR0aD0iMzIiIHN0cm9rZS1vcGFjaXR5PSIxIiBzdHJva2UtbWl0ZXJsaW1pdD0iNCIvPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJidXR0IiB0cmFuc2Zvcm09Im1hdHJpeCgwLCAwLjc0OTM1MSwgLTAuNzQ5MzUxLCAwLCA4MC42NDk5MjcsIDg1Ljg0MDM0KSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgZD0iTSAtMC4wMDA2NjE2NSAxNi4wMDAyMDMgTCAzMS44ODEwODcgMTYuMDAwMjAzICIgc3Ryb2tlPSIjMGYxODE5IiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2Utb3BhY2l0eT0iMSIgc3Ryb2tlLW1pdGVybGltaXQ9IjQiLz48cGF0aCBzdHJva2UtbGluZWNhcD0iYnV0dCIgdHJhbnNmb3JtPSJtYXRyaXgoMCwgMC43NDkzNTEsIC0wLjc0OTM1MSwgMCwgODAuNjQ5OTI3LCAxODEuNDA0MjU3KSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgZD0iTSAtMC4wMDI1NTM1MyAxNi4wMDAyMDMgTCAzMS44ODQ0MDggMTYuMDAwMjAzICIgc3Ryb2tlPSIjMGYxODE5IiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2Utb3BhY2l0eT0iMSIgc3Ryb2tlLW1pdGVybGltaXQ9IjQiLz48ZyBjbGlwLXBhdGg9InVybCgjMmMxMWQ1NDFiNikiPjxnIGNsaXAtcGF0aD0idXJsKCM3NjIwN2Q5N2VjKSI+PHBhdGggZmlsbD0iIzBmMTgxOSIgZD0iTSAxNDQuMzk0NTMxIDEyMC44ODY3MTkgTCAxOTMuNzQ2MDk0IDEyMC44ODY3MTkgTCAxOTMuNzQ2MDk0IDE3MC4yNDIxODggTCAxNDQuMzk0NTMxIDE3MC4yNDIxODggWiBNIDE0NC4zOTQ1MzEgMTIwLjg4NjcxOSAiIGZpbGwtb3BhY2l0eT0iMSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PC9nPjwvZz48ZyBjbGlwLXBhdGg9InVybCgjOTQxNTQ3MTM1ZikiPjxnIGNsaXAtcGF0aD0idXJsKCMxZGEzNDgyMjc5KSI+PHBhdGggZmlsbD0iIzBmMTgxOSIgZD0iTSAxMTQuOTA2MjUgMTMzLjYyMTA5NCBMIDE3My44ODY3MTkgMTMzLjYyMTA5NCBMIDE3My44ODY3MTkgMTU3LjUxMTcxOSBMIDExNC45MDYyNSAxNTcuNTExNzE5IFogTSAxMTQuOTA2MjUgMTMzLjYyMTA5NCAiIGZpbGwtb3BhY2l0eT0iMSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PC9nPjwvZz48L3N2Zz4=';

export default vaultlayer;
