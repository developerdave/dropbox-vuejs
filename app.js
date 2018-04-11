/**
 * The Vuex Store
 */
const store = new Vuex.Store({
    state: {
        // Current folder path
        path: '',

        // The cached folder contents
        structure: {},

        // The current breadcrumb
        breadcrumb: []
    },
    mutations: {
        /**
         * Update the path & breadcrumb components
         * @param {object} state The state object of the store
         */
        updateHash(state) {
            let path = (window.location.hash.substring(1) || ''),
                breadcrumb = [],
                slug = '',
                parts = path.split('/');

            for (let item of parts) {
                slug += item;
                breadcrumb.push({'name': item || 'home', 'path': slug});
                slug+= '/';
            }

            state.path = path;
            state.breadcrumb = breadcrumb;
        },

        /**
         * Cache a folder structure
         * @param {object} state The state object of the store
         * @param {object} payload An object containing the slug and data to store
         */
        structure(state, payload) {
            /**
             * Sample Data:
             * 
             *   {
             *      path: 'images-holidays',
             *      data: [{...}]
             *   }
             */
            state.structure[payload.path] = payload.data; 
        }
    }
});

/**
 * Displays the folder tree breadcrumb
 * @example <breadcrumb></breadcrumb>
 */
Vue.component('breadcrumb', {
    template: '<div>' +
        '<span v-for="(f, i) in folders">' +
            '<a :href="f.path">{{ f.name }}</a>' +
            '<i v-if="i !== (folders.length - 1)"> &raquo; </i>' +
        '</span>' +
    '</div>',
    computed: {
        folders() {
            return this.$store.state.breadcrumb;
        }
    }
});

/**
 * Displays a folder with a link and cache its contents
 * @example <folder :f="entry" :cache="getFolderStructure"></folder>
 * 
 * @param {object} f The folder entry from the tree
 * @param {function} cache The getFolderStructure method from the dropbox-viewer component
 */
Vue.component('folder', {
    /** @click.prevent adds preventDefault to the link action. */
    template: '<li class="icon-folder-empty"><strong><a :href="\'#\' + f.path_lower">{{ f.name }}</a></strong></li>',
    props: {
        f: Object,
        cache: Function
    },
    created() {
        // Cache the contents of the folder
        this.cache(this.f.path_lower);
    }
});

/**
 * File component display size of file and download link
 * @example <file :d="dropbox()" :f="entry"></file>
 * 
 * @param {object} f The file entry from the tree
 * @param {object} d The dropbox instance from the parent component
 */
Vue.component('file', {
    template: '<li class="icon-doc-text"><strong>{{ f.name }}</strong><span>- {{ bytesToSize(f.size) }}</span> - <a v-if="link" :href="link">Download</a></li>',
    
    props: {

        /** Individual file object. */
        f: Object,

        /** We need the Dropbox instance so we can download each file. */
        d: Object
    },
    data() {
        return {
            
            /** Holds the size suffix calculated using Math.floor(Math.log(bytes) / Math.log(1024)) */
            byteSizes: ['Bytes', 'KB', 'MB', 'GB', 'TB' ], 
            
            // The download link
            link: false
        }
    },
    methods: {

        /**
         * Convert an integer to a human readable file size
         * @param {integer} bytes 
         * @return {string}
         */
        bytesToSize(bytes) {
            // Set a default
            let output = '0 Byte';

            // If the bytes are bigger than 0
            if (bytes > 0) {
                // Divide by 1024 and make an Int
                let i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
                // Round to 2dp and select the appropriate unit from the array
                output = Math.round(bytes / Math.pow(1024, i), 2) + ' ' + this.byteSizes[i];
            }
            return output;
        }
    },
    created() {

        // If the download link has been retrieved from the API, use it
        // if not, query the API
        if (this.f.download_link) {
            this.link = this.f.download_link;
        } else {
            this.d.filesGetTemporaryLink({path: this.f.path_lower}).then(data => {
                this.f.download_link = this.link = data.link;
            });
        }
    }
});

/**
 * The dropbox component
 * @example <dropbox-viewer></dropbox-viewer>
 */
Vue.component('dropbox-viewer', {
    template: '#dropbox-viewer-template',
    data() {
        return {
            /** Dropbox access token */
            accessToken: config.common.api_key,

            /** Holds dropbox().filesListFolder response */
            structure: {},

            /** Holds whether we are currently retrieving data from Dropbox API */
            isLoading: true
        }
    },
    methods: {

        /**
         * Initialize Dropbox client
         * @type {dropbox}
         */
        dropbox() {
            return new Dropbox.Dropbox({
                accessToken: this.accessToken
            });
        },

        /**
         * Loop through the breadcrumb and cache parent folders
         */
        cacheParentFolders() {
            let parents = this.$store.state.breadcrumb;
            parents.reverse().shift();

            for (let parent of parents) {
                this.getFolderStructure(parent.path);
            }
        },

        /**
         * Retrieve the folder structure from the cahce or Dropbox API
         * @param {string} path The folder path
         * @return {Promise} A promise containing the folder data
         */
        getFolderStructure(path) {
            let output;

            const slug = this.generateSlug(path);
            data = this.$store.state.structure[slug];

            if (data) {
                output = Promise.resolve(data);
            } else {

                console.log('API query for ${path}');
                output = this.dropbox().filesListFolder({

                    path: path,
                    include_media_info: true
                })
                .then(response => {

                    console.log('Response for ${path}');
                    let entries = response.entries;

                    this.$store.commit('structure', {
                        path: slug,
                        data: entries
                    });

                    return entries;
                })
                .catch(error => {
                    
                    this.isLoading = 'error';
                    console.log(error);
                });

            }

            return output;
        },

        /**
         * Display the contents of getFolderStructure
         * Updates the output to display the files and folders
         */
        displayFolderStructure() {

            // Set the app to loading
            this.isLoading = true;

            // Create an empty object
            const structure = {
                folders: [],
                files: []
            }

            // Get the structure
            this.getFolderStructure(this.path).then(data => {

                for (let entry of data) {

                    // Check ".tag" prop for type
                    if (entry['.tag'] == 'folder') {
                        structure.folders.push(entry);
                    } else {
                        structure.files.push(entry);
                    }
                }

                // Update the data object
                this.structure = structure;
                this.isLoading = false;
            });
        },

        /**
         * 
         * @param {string} path The path to a folder
         * @return {string} A cache-friendly URL without punctuation/symbols.
         */
        generateSlug(path) {
            return path.toLowerCase()
                .replace(/^\/|\/$/g, '')
                .replace(/ /g,'-')
                .replace(/\//g,'-')
                .replace(/[-]+/g, '-')
                .replace(/[^\w-]+/g,'');
        }
    },

    created() {
        this.displayFolderStructure();
        this.cacheParentFolders();
    },

    computed: {

        /** The current folder path. */
        path() {
            return this.$store.state.path;
        },

        slug() {

            /** Sanitized URL */
            return this.path.toLowerCase()
                .replace(/^\/|\/$/g, '')
                .replace(/ /g,'-')
                .replace(/\//g,'-')
                .replace(/[-]+/g, '-')
                .replace(/[^\w-]+/g,'');    
        }
    },

    watch: {
        path() {
            this.displayFolderStructure();
        },

        structure: {

            /** Structure always has two keys files and folders. The deep key is required
             * to identify nested changes.
             */
            deep: true,
            handler() {
                for (let folder of this.structure.folders) {
                    this.getFolderStructure(folder.path_lower);
                }
            }
        }
    },
});

/**
 * The Vue app
 */
const app = new Vue({
    el: '#app',

    /** Good practice to associate stor with app, doing so 
     * also injects the store instance into all child components.
     */
    store,  /** Can be accessed using the this.$store variable. */

    // Update the current path on path load
    mounted() {
        store.commit('updateHash');
    }
});

/**
 * Update the path & store when the URL hash changes
 */
window.onhashchange = () => {
    app.$store.commit('updateHash');
}