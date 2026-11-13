
# Payments task

Viską gali pasileist su
```
pnpm run prep
pnpm run dev
```

/apps/payments-api - pagrindinis core servisas
/apps/psp-adapter - PSP adapteris kuris komunikuoja su įvairiais PSPs ir viską sustandartizuoja payments-api servisui (šiuo metu yra vienas mock PSP)
/packages - bendri package'ai naudojami abiejuose servisuose

Pridėjau ir /apps/admin-ui ir /examples/shop kad šiek tiek pasitestuoti, bet daug pastangų į juos nedėjau tai atrodo baisiai


