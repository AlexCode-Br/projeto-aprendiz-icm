export function consumeSecureLinkParameters() {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = fragment.get('token') || query.get('token') || '';
    const type = fragment.get('tipo') || query.get('tipo') || '';
    if (window.location.search || window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    return { token, type };
}
