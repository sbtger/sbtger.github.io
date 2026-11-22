const destination = new URL(document.querySelector('link[rel="canonical"]').href);
location.replace(destination.pathname + location.search + (destination.hash || location.hash));
