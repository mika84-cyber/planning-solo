  (function(){
    /* On distingue le TYPE d'appareil de la TAILLE de l'ecran.
       Un telephone pliable ouvert, ou une tablette, annonce souvent
       userAgentData.mobile = false a cause de sa largeur : il reste
       pourtant un appareil tactile, avec le menu de partage du systeme.
       device-touch pilote donc les fonctions tactiles, et la largeur CSS
       pilote seule la mise en page. */
    var ua = navigator.userAgent || '';
    var uaTactile = /Android|iPhone|iPad|iPod/i.test(ua);
    var pointeurGrossier = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var multiTouch = (navigator.maxTouchPoints || 0) > 1;
    var tactile = uaTactile
      || (multiTouch && pointeurGrossier)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); /* iPad */
    /* Une seule classe, posee une fois : elle ne depend pas de la largeur,
       donc plier/deplier l'appareil ne la rend jamais fausse. La mise en
       page, elle, suit les media queries et se reajuste toute seule. */
    document.documentElement.classList.add(tactile ? 'device-touch' : 'device-desktop');
  })();
