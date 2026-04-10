'use strict';

hexo.extend.generator.register('zen_tags_index', function (locals) {
  const tagDir = this.config.tag_dir || 'tags';
  const tagsIndexPath = `${tagDir}/index.html`;

  // Respect a user-defined page at the same path if it already exists.
  const hasCustomTagsPage = locals.pages && locals.pages.findOne({ path: tagsIndexPath });
  if (hasCustomTagsPage) {
    return [];
  }

  return {
    path: tagsIndexPath,
    layout: ['tags', 'page', 'archive', 'index'],
    data: {
      title: '标签',
      comments: false
    }
  };
});
