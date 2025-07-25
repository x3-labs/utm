var Webflow = Webflow || [];
Webflow.push(function() {  
  // unbind webflow form handling (keep this if you only want to affect specific forms)
  $(document).off('submit');
  
  // Helper function for safe URL encoding
  function safeEncodeURIComponent(value) {
    try {
      return encodeURIComponent(value || '');
    } catch (e) {
      return '';
    }
  }
  
  // Helper function for safe cookie extraction
  function getCookieValue(cookieName) {
    try {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const trimmedCookie = cookie.trim();
        if (trimmedCookie.startsWith(cookieName + '=')) {
          return trimmedCookie.substring(cookieName.length + 1);
        }
      }
      return '';
    } catch (e) {
      return '';
    }
  }
  
  // Helper function for extracting GA Client ID (supports both Universal Analytics and GA4)
  function getGAClientId() {
    try {
      // Try GA4 first (_ga_<MEASUREMENT_ID>)
      const ga4Cookie = document.cookie.split(';').find(cookie => 
        cookie.trim().match(/^_ga_[A-Z0-9]+=/));
      if (ga4Cookie) {
        const cookieParts = ga4Cookie.split('=');
        if (cookieParts.length >= 2 && cookieParts[1]) {
          const parts = cookieParts[1].split('.');
          if (parts.length >= 4) {
            return parts[2] + '.' + parts[3];
          }
        }
      }
      
      // Fallback to Universal Analytics (_ga)
      const gaCookie = getCookieValue('_ga');
      if (gaCookie) {
        const parts = gaCookie.split('.');
        if (parts.length >= 4) {
          return parts[2] + '.' + parts[3];
        }
      }
      
      return '';
    } catch (e) {
      return '';
    }
  }
  
  /* Any form on the page */
  $('form').submit(function(e) {
    e.preventDefault();
    
    const $form = $(this); // The submitted form
    const $submit = $('[type=submit]', $form); // Submit button of form
    const buttonText = $submit.val(); // Original button text
    const buttonWaitingText = $submit.attr('data-wait'); // Waiting button text value
    const formMethod = $form.attr('method') || 'POST'; // Form method (default POST)
    const formAction = $form.attr('action'); // Form action URL
    const formRedirect = $form.attr('data-redirect'); // Form redirect location
    
    // Validate required form attributes
    if (!formAction) {
      console.error('Form action attribute is required');
      return false;
    }
    
    let formData = $form.serialize(); // Form data
    
    try {
      // Extracting UTM parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source') || '';
      const utmMedium = urlParams.get('utm_medium') || '';
      const utmCampaign = urlParams.get('utm_campaign') || '';
      const utmContent = urlParams.get('utm_content') || '';
      const utmTerm = urlParams.get('utm_term') || '';
      
      // Extracting additional tracking parameters from URL
      const gclid = urlParams.get('gclid') || '';
      const fbclid = urlParams.get('fbclid') || '';
      const ttclid = urlParams.get('ttclid') || '';
      
      // Adding UTM parameters to form data with proper encoding
      if (utmSource) formData += `&utm_source=${safeEncodeURIComponent(utmSource)}`;
      if (utmMedium) formData += `&utm_medium=${safeEncodeURIComponent(utmMedium)}`;
      if (utmCampaign) formData += `&utm_campaign=${safeEncodeURIComponent(utmCampaign)}`;
      if (utmContent) formData += `&utm_content=${safeEncodeURIComponent(utmContent)}`;
      if (utmTerm) formData += `&utm_term=${safeEncodeURIComponent(utmTerm)}`;
      
      // Adding tracking click IDs to form data with proper encoding
      if (gclid) formData += `&gclid=${safeEncodeURIComponent(gclid)}`;
      if (fbclid) formData += `&fbclid=${safeEncodeURIComponent(fbclid)}`;
      if (ttclid) formData += `&ttclid=${safeEncodeURIComponent(ttclid)}`;
      
      // Adding form name to form data
      const formDataName = $form.attr('data-name');
      if (formDataName) {
        formData += `&formName=${safeEncodeURIComponent(formDataName)}`;
      }
      
      // Adding current page URL to form data
      const currentPageURL = window.location.href.split('?')[0]; // Get URL without parameters
      if (currentPageURL) {
        formData += `&pageURL=${safeEncodeURIComponent(currentPageURL)}`;
      }
      
      // Adding Google Analytics Client ID to form data
      const clientId = getGAClientId();
      if (clientId) {
        formData += `&gaClientId=${safeEncodeURIComponent(clientId)}`;
      }
      
      // Extracting Facebook pixel parameters from cookies
      const fbp = getCookieValue('_fbp');
      const fbc = getCookieValue('_fbc');
      
      // Adding Facebook pixel parameters to form data
      if (fbp) formData += `&fbp=${safeEncodeURIComponent(fbp)}`;
      if (fbc) formData += `&fbc=${safeEncodeURIComponent(fbc)}`;
      
    } catch (error) {
      console.warn('Error extracting tracking parameters:', error);
      // Continue with form submission even if tracking parameter extraction fails
    }
    
    // Set waiting text
    if (buttonWaitingText) {
      $submit.val(buttonWaitingText); 
    }
    
    // Disable submit button to prevent double submission
    $submit.prop('disabled', true);
    
    $.ajax(formAction, {
      data: formData,
      method: formMethod,
      timeout: 30000 // 30 second timeout
    })
    .done((res) => {
      // If form redirect setting set, then use this and prevent any other actions
      if (formRedirect) { 
        window.location = formRedirect; 
        return; 
      }
      $form
        .hide() // optional hiding of form
        .siblings('.w-form-done').show() // Show success
        .siblings('.w-form-fail').hide(); // Hide failure
    })
    .fail((res) => {
      console.error('Form submission failed:', res);
      $form
        .siblings('.w-form-done').hide() // Hide success
        .siblings('.w-form-fail').show(); // show failure
    })
    .always(() => {
      // Reset button text and re-enable
      $submit.val(buttonText).prop('disabled', false);
    });
  });
});
