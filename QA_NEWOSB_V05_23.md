# QA NEWOSB V05.23

- `node -c newosb.js` : OK
- `node -c requirements.js` : OK
- absence de `resetScroll:true` : OK
- absence de `pageEl.scrollTop = 0` dans NEWOSB : OK
- filtres globaux encapsulés dans la conservation de scroll : OK
- filtres Exigences transmettent leur position de scroll au rerender : OK
- focus recherche Exigences avec `preventScroll` : OK
- CSS anti-scroll-anchoring : OK
- Code_Operations.gs inchangé par rapport à V05.22 : à vérifier au hash lors du packaging
