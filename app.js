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
            parts = this.p.split('/');

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
    template: '<li class="icon-doc-text"><strong>{{ f.name }}</strong><span>- {{ bytesToSize(f.size) }}</span></li>',
    
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
    props: {
        path: String
    },
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
        getFolderStructure(path) {
            var self = this;
            this.dropbox().filesListFolder({
                path: path,
                include_media_info: true
            })
                .then(response => {

                    const structure = {
                        folders: [],
                        files: []
                    }

                    for (let entry of response.entries) {
                        if (entry['.tag'] === 'folder') {
                            structure.folders.push(entry);
                        } else {
                            structure.files.push(entry);
                        }
                    }

                    self.structure = structure;
                    self.isLoading = false;
                })
                .catch(error => {
                    console.log(error);
                });
        },
        updateStructure(path) {
            this.isLoading = true;
            this.getFolderStructure(path);
        }
    },
    created() {
        this.getFolderStructure(this.path);
    },
    watch: {
        path() {
            this.updateStructure(this.path);
        }
    },
});

const app = new Vue({
    el: '#app',
    data: {
        path: ''
    },
    methods: {
        updateHash() {
            let hash = window.location.hash.substring(1);
            this.path = (hash || '');
        }
    },
    created() {
        this.updateHash()
    }
});

window.onhashchange = () => {
    app.updateHash();
}