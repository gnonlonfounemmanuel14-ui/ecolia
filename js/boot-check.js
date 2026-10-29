// Filet de sécurité : si les scripts du site ne se sont pas chargés, un clic sur « envoyer »
// ne reste plus sans réponse. Ce fichier est volontairement un script classique, sans dépendance.
(function () {
  var FORMS = '[data-login-form],[data-register-form],[data-contact-form],[data-api-form],[data-school-form],[data-verify-form]';

  function problem() {
    if (location.protocol === 'file:') {
      return 'Ouvrez le site avec un serveur local (par exemple http://localhost:5500). En double-cliquant sur le fichier, le navigateur bloque les scripts.';
    }
    if (!window.__ecoliaReady) {
      return 'Les scripts du site n’ont pas pu se charger. Actualisez la page (Ctrl+F5). Si le problème continue, vérifiez que tous les fichiers du dossier js/ sont bien à jour.';
    }
    if (window.__ecoliaLibError) {
      return 'La bibliothèque de connexion n’a pas pu être téléchargée. Vérifiez votre connexion Internet, puis actualisez la page.';
    }
    return '';
  }

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target;
      if (!form || !form.matches || !form.matches(FORMS)) return;
      if (document.readyState !== 'complete') return;
      var text = problem();
      if (!text) return;
      // On bloque l'événement : sinon le formulaire afficherait son message générique par-dessus celui-ci.
      event.preventDefault();
      event.stopPropagation();
      var box = form.querySelector('[data-auth-submit-message]') || document.querySelector('[data-auth-message]');
      if (!box) {
        window.alert(text);
        return;
      }
      box.textContent = text + ' ';
      var link = document.createElement('a');
      link.href = 'diagnostic.html';
      link.textContent = 'Lancer le diagnostic';
      box.appendChild(link);
      box.classList.add('is-error');
      box.hidden = false;
    },
    true
  );
})();