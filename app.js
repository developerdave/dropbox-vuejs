const store = new Vuex.Store({
    state: {
        path: '',
        structure: {}
    },
    mutations: {
        updateHash(state) {
            let hash = window.location.hash.substring(1);
            state.path = (hash || '');
        },

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

Vue.component('breadcrumb', {
    template: '<div>' +
        '<span v-for="(f, i) in folders">' +
            '<a :href="f.path">{{ f.name }}</a>' +
            '<i v-if="i !== (folders.length - 1)"> &raquo; </i>' +
        '</span>' +
    '</div>',
    props: {
        p: String
    },
    computed: {
        folders() {
            let output = [];
            slug = '';
            parts = this.$store.state.path.split('/');

            for (let item of parts) {
                slug += item;
                output.push({'name': item || 'home', 'path': '#' + slug});
                slug += '/';
            }
            return output;
        }
    }
});

Vue.component('folder', {
    /** @click.prevent adds preventDefault to the link action. */
    template: '<li class="icon-folder-empty"><strong><a :href="\'#\' + f.path_lower">{{ f.name }}</a></strong></li>',
    props: {
        f: Object
    }
});

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
            link: false
        }
    },
    methods: {
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
        this.d.filesGetTemporaryLink({path: this.f.path_lower}).then(data => {
            this.link = data.link;
        });
    }
});

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

        createFolderStructure(response) {
            const structure = {
                folders: [],
                files: []
            }

            for (let entry of response.entries) {

                /** Check ".tag" prop for type */
                if (entry['.tag'] == 'folder') {
                    structure.folders.push(entry);
                } else {
                    structure.files.push(entry);
                }
            }

            this.structure = structure;
            this.isLoading = false; 
        },

        createStructureAndSave(response) {
            this.createFolderStructure(response);
            this.$store.commit('structure', {
                path: this.slug,
                data: response
            });
        },

        getFolderStructure() {
            var self = this;

            let data = this.$store.state.structure[this.slug];
            if (data) {
                this.createFolderStructure(data);
            } else {

                this.dropbox().filesListFolder({
                    path: this.$store.state.path,
                    include_media_info: true
                })
                .then(this.createStructureAndSave)
                .catch(error => {
                    console.log(error);
                });
            }
        },

        updateStructure() {
            this.isLoading = true;
            this.getFolderStructure();
        }
    },

    created() {
        this.getFolderStructure();
    },

    computed: {
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
            this.updateStructure();
        }
    },
});

const app = new Vue({
    el: '#app',

    /** Good practice to associate stor with app, doing so 
     * also injects the store instance into all child components.
     */
    store,  /** Can be accessed using the this.$store variable. */

    created() {
        store.commit('updateHash');
    }
});

window.onhashchange = () => {
    app.$store.commit('updateHash');
}