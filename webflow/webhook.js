var Webflow = Webflow || [];
Webflow.push(function() {  
  // Unbind Webflow's default form handling
  $(document).off('submit', 'form');
  
  // Handle form submission
  $('form').submit(function(e) {
    e.preventDefault();
    const $form = $(this); // The submitted form
    const $submit = $form.find('[type=submit]'); // Submit button of form
    const buttonText = $submit.val(); // Original button text
    const buttonWaitingText = $submit.attr('data-wait'); // Waiting button text value
    const formMethod = $form.attr('method') || 'POST'; // Default to POST if not set
    const formAction = $form.attr('action'); // Form action
    const formRedirect = $form.attr('data-redirect'); // Form redirect location

    // Validate form action
    if (!formAction) {
      console.error('Form action is missing');
      $form.siblings('.w-form-fail').show();
      $form.siblings('.w-form-done').hide();
      return;
    }

    let formData = $form.serialize(); // Form data
    // Extract UTM and additional parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source') || '';
    const utmMedium = urlParams.get('utm_medium') || '';
    const utmCampaign = urlParams.get('utm_campaign') || '';
    const utmContent = urlParams.get('utm_content') || '';
    const utmTerm = urlParams.get('utm_term') || '';
    const gclid = urlParams.get('gclid') || '';
    const fbclid = urlParams.get('fbclid') || '';
    const ttclid = urlParams.get('ttclid') || '';
    // Extract fbp and fbc from cookies or URL
    const fbpCookie = document.cookie.split(';').find(cookie => cookie.trim().startsWith('_fbp='));
    const fbcCookie = document.cookie.split(';').find(cookie => cookie.trim().startsWith('_fbc='));
    const fbp = fbpCookie ? fbpCookie.split('=')[1] : urlParams.get('fbp') || '';
    const fbc = fbcCookie ? fbcCookie.split('=')[1] : urlParams.get('fbc') || '';

    // Add parameters to form data
    formData += `&utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}&utm_content=${encodeURIComponent(utmContent)}&utm_term=${encodeURIComponent(utmTerm)}`;
    formData += `&gclid=${encodeURIComponent(gclid)}&fbclid=${encodeURIComponent(fbclid)}&ttclid=${encodeURIComponent(ttclid)}&fbp=${encodeURIComponent(fbp)}&fbc=${encodeURIComponent(fbc)}`;

    // Add form name to form data
    const formDataName = $form.attr('data-name') || '';
    formData += `&formName=${encodeURIComponent(formDataName)}`;

    // Add current page URL to form data
    const currentPageURL = window.location.href.split('?')[0];
    formData += `&pageURL=${encodeURIComponent(currentPageURL)}`;

    // Extract Google Analytics Client ID
    const gaCookie = document.cookie.split(';').find(cookie => cookie.trim().startsWith('_ga='));
    let clientId = '';
    if (gaCookie) {
      const parts = gaCookie.split('.');
      if (parts.length >= 4) {
        clientId = parts[2] + '.' + parts[3];
      }
    }
    formData += `&gaClientId=${encodeURIComponent(clientId)}`;

    // Set waiting text
    if (buttonWaitingText) {
      $submit.val(buttonWaitingText); 
    }

    $.ajax({
      url: formAction,
      data: formData,
      method: formMethod,
      dataType: 'json' // Expect JSON response from Webflow
    })
    .done((res) => {
      // Handle redirect if set
      if (formRedirect) { 
        try {
          new URL(formRedirect); // Validate URL
          window.location = formRedirect; 
          return; 
        } catch (err) {
          console.error('Invalid redirect URL:', formRedirect);
        }
      }
      // Show Webflow success state
      $form.hide();
      $form.siblings('.w-form-done').show();
      $form.siblings('.w-form-fail').hide();
    })
    .fail((res) => {
      // Show Webflow failure state
      console.error('Form submission failed:', res);
      $form.siblings('.w-form-done').hide();
      $form.siblings('.w-form-fail').show();
    })
    .always(() => {
      // Reset button text
      if (buttonWaitingText) {
        $submit.val(buttonText);
      }
    });
  });
});
